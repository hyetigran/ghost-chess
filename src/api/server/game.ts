import { Chess } from 'chess.js';
import { supabase } from '~/api/supabase/client';
import { z } from 'zod';
import { gameSchema, moveSchema, playerViewSchema } from '~/types/database';
import type {
  Game,
  GameSettings,
  Move,
  GameState,
  GameResult,
  PlayerView,
} from '~/types/database';

/**
 * Create a new game
 */
export async function createGame(
  userId: string,
  settings: GameSettings,
): Promise<Game> {
  const chess = new Chess();
  const initialFen = chess.fen();

  // Randomly assign players to white and black
  const isUserWhite = Math.random() < 0.5;
  const whitePlayerId = isUserWhite ? userId : null;
  const blackPlayerId = isUserWhite ? null : userId;

  const { data, error } = await supabase
    .from('games')
    .insert({
      white_player_id: whitePlayerId,
      black_player_id: blackPlayerId,
      settings,
      status: 'waiting',
      current_turn: 'white',
      fen: initialFen,
      white_time_remaining: settings.timeControl,
      black_time_remaining: settings.timeControl,
    })
    .select()
    .single();

  if (error) throw error;
  return gameSchema.parse(data);
}

/**
 * Get game state
 */
export async function getGameState(gameId: string): Promise<GameState> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (error) throw error;

  const game = gameSchema.parse(data);
  return {
    chess: new Chess(game.fen),
    lastMoveTime: Date.now(),
    white_time_remaining: game.white_time_remaining,
    black_time_remaining: game.black_time_remaining,
  };
}

/**
 * Make a move
 */
export async function makeMove(
  gameId: string,
  playerId: string,
  gameState: GameState,
  from: string,
  to: string,
  promotion?: string,
): Promise<Move> {
  const move = gameState.chess.move({ from, to, promotion });
  if (!move) {
    throw new Error('Invalid move');
  }

  // Moves are always inserted, and games always updated, while the game is
  // 'active' — and games'/moves' SELECT RLS denies active-game rows (#12).
  // Since Postgres requires a row to pass the table's SELECT policy before
  // UPDATE can even see it (and moves' INSERT policy needs to read games to
  // check participancy), neither a direct .insert() nor a direct .update()
  // can reach these rows anymore. submit_own_move is a security-definer RPC
  // that does both writes atomically after checking participancy itself.
  const { data, error } = await supabase.rpc('submit_own_move', {
    p_game_id: gameId,
    p_move_number: gameState.chess.history().length,
    p_move_text: move.san,
    p_fen: gameState.chess.fen(),
    p_captured_piece: move.captured ?? null,
    p_current_turn: gameState.chess.turn() === 'w' ? 'white' : 'black',
    p_white_time_remaining:
      gameState.chess.turn() === 'w'
        ? gameState.white_time_remaining -
          (Date.now() - gameState.lastMoveTime) / 1000
        : gameState.white_time_remaining,
    p_black_time_remaining:
      gameState.chess.turn() === 'b'
        ? gameState.black_time_remaining -
          (Date.now() - gameState.lastMoveTime) / 1000
        : gameState.black_time_remaining,
  });

  if (error) throw error;
  return moveSchema.parse(data);
}

/**
 * Get game moves
 */
export async function getGameMoves(gameId: string): Promise<Move[]> {
  const { data, error } = await supabase
    .from('moves')
    .select('*')
    .eq('game_id', gameId)
    .order('move_number', { ascending: true });

  if (error) throw error;
  return z.array(moveSchema).parse(data);
}

/**
 * End game
 */
export async function endGame(
  gameId: string,
  result: GameResult,
  winnerId?: string,
): Promise<Game> {
  // Resignation always targets a currently-'active' game — same RLS
  // conflict as makeMove above, so this goes through the equivalent
  // security-definer RPC rather than a direct .update() (#12).
  const { data, error } = await supabase.rpc('end_own_game', {
    p_game_id: gameId,
    p_status: 'completed',
    p_result: result,
    p_winner_id: winnerId ?? null,
  });

  if (error) throw error;
  return gameSchema.parse(data);
}

/**
 * Get the caller's redacted view of a game (ADR-0001, #12). This is the
 * only way a client reads game state while a game is active — `games`
 * RLS denies direct SELECT for active games specifically (see
 * 05_rls.sql), so a raw `games` query here would just return nothing for
 * the one status that actually has secrets to protect. `player_views`
 * carries everything the UI needs (own/redacted board, clocks, check,
 * captures, and — since #12 — both player IDs) without ever exposing the
 * true position while the game is still being played.
 */
export async function getGame(gameId: string): Promise<PlayerView> {
  const { data, error } = await supabase
    .from('player_views')
    .select('*')
    .eq('game_id', gameId)
    .single();

  if (error) throw error;
  return playerViewSchema.parse(data);
}
