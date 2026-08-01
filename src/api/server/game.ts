import { Chess } from 'chess.js';
import { supabase } from '~/api/supabase/client';
import { z } from 'zod';
import { gameSchema, moveSchema } from '~/types/database';
import type { Game, GameSettings, Move, GameResult } from '~/types/database';

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
 * The uniform code returned for every illegal-move reason (ADR-0007) is
 * "illegal_move" — this type also includes the non-board-related failure
 * modes (auth, rate limiting, not found), which are allowed to differ
 * since they don't disclose anything about hidden game state.
 */
export type SubmitMoveErrorCode =
  | 'illegal_move'
  | 'unauthorized'
  | 'rate_limited'
  | 'not_found'
  | 'internal_error';

export class SubmitMoveError extends Error {
  code: SubmitMoveErrorCode;
  constructor(code: SubmitMoveErrorCode) {
    super(code);
    this.code = code;
  }
}

/**
 * Submit a move for server-side validation (ADR-0001, ADR-0007). This is
 * the only path that ever writes to games/moves — there is no client-side
 * legality check and no separate pre-flight endpoint; the move is either
 * accepted or rejected in this one call. The true resulting state is
 * deliberately not returned here (ADR-0001) — callers should read the new
 * state from player_views, not from this response.
 */
export async function submitMove(
  gameId: string,
  from: string,
  to: string,
  promotion?: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke('submit-move', {
    body: { gameId, from, to, promotion },
  });

  if (!error) return;

  let code: SubmitMoveErrorCode = 'internal_error';
  const context = (error as { context?: Response }).context;
  if (context) {
    try {
      const body = (await context.json()) as { error?: string };
      if (
        body.error === 'illegal_move' ||
        body.error === 'unauthorized' ||
        body.error === 'rate_limited' ||
        body.error === 'not_found'
      ) {
        code = body.error;
      }
    } catch {
      // Response body wasn't JSON — fall through to internal_error.
    }
  }

  throw new SubmitMoveError(code);
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
