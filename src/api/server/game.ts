import { Chess } from 'chess.js';
import { supabase } from '~/api/supabase/client';
import { z } from 'zod';
import { gameSchema, moveSchema } from '~/types/database';
import type {
  Game,
  GameSettings,
  Move,
  GameState,
  GameResult,
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

  const { data, error } = await supabase
    .from('moves')
    .insert({
      game_id: gameId,
      player_id: playerId,
      move_number: gameState.chess.history().length,
      move_text: move.san,
      fen: gameState.chess.fen(),
      captured_piece: move.captured,
    })
    .select()
    .single();

  if (error) throw error;

  // Update game state in database
  await supabase
    .from('games')
    .update({
      fen: gameState.chess.fen(),
      current_turn: gameState.chess.turn() === 'w' ? 'white' : 'black',
      white_time_remaining:
        gameState.chess.turn() === 'w'
          ? gameState.white_time_remaining -
            (Date.now() - gameState.lastMoveTime) / 1000
          : gameState.white_time_remaining,
      black_time_remaining:
        gameState.chess.turn() === 'b'
          ? gameState.black_time_remaining -
            (Date.now() - gameState.lastMoveTime) / 1000
          : gameState.black_time_remaining,
    })
    .eq('id', gameId);

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
  const { data, error } = await supabase
    .from('games')
    .update({
      status: 'completed',
      result,
      winner_id: winnerId,
    })
    .eq('id', gameId)
    .select()
    .single();

  if (error) throw error;
  return gameSchema.parse(data);
}

/**
 * Get game by ID
 */
export async function getGame(gameId: string): Promise<Game> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (error) throw error;
  return gameSchema.parse(data);
}
