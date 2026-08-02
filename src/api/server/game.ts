import { Chess } from 'chess.js';
import { supabase } from '~/api/supabase/client';
import { z } from 'zod';
import { gameSchema, moveSchema, playerViewSchema } from '~/types/database';
import type { Game, GameSettings, Move, PlayerView } from '~/types/database';

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
      // games.pgn is NOT NULL with no default (supabase/schemas/02_games.sql)
      // — omitting it here made every real game-creation attempt fail with
      // a not-null constraint violation, found while testing #25's join
      // flow against a live local instance. A fresh game with zero moves
      // has an empty PGN, not a null one.
      pgn: '',
    })
    .select()
    .single();

  if (error) throw error;
  return gameSchema.parse(data);
}

/**
 * Join a game that's waiting for a second player (#25) — the
 * game-ID-based invite accept, per ADR-0005: identifies the game only by
 * its uuid, never by the inviter's identity. join_game (security definer,
 * supabase/schemas/06_functions.sql) does the actual atomic slot-fill and
 * status transition; RLS has no UPDATE policy on games at all, so this
 * can't be a plain client update.
 */
export async function joinGame(gameId: string): Promise<Game> {
  const { data, error } = await supabase.rpc('join_game', {
    p_game_id: gameId,
  });

  if (error) throw error;
  return gameSchema.parse(data);
}

/**
 * The uniform code returned for every illegal-move reason (ADR-0007,
 * including a nonexistent gameId — a distinct "not found" response would
 * confirm which game IDs are real before any board-related check runs) is
 * "illegal_move". "unauthorized" and "rate_limited" are allowed to differ
 * since neither discloses anything about hidden game state.
 */
export type SubmitMoveErrorCode =
  | 'illegal_move'
  | 'unauthorized'
  | 'rate_limited'
  | 'internal_error';

export type SubmitMoveError = Error & { code: SubmitMoveErrorCode };

function submitMoveError(code: SubmitMoveErrorCode): SubmitMoveError {
  return Object.assign(new Error(code), { code });
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
        body.error === 'rate_limited'
      ) {
        code = body.error;
      }
    } catch {
      // Response body wasn't JSON — fall through to internal_error.
    }
  }

  throw submitMoveError(code);
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
 * Resign a game. Result and winner are decided server-side (always
 * 'abandoned', always the other participant) — see end_own_game's doc
 * comment for why nothing about the outcome is accepted from the client.
 */
export async function endGame(gameId: string): Promise<Game> {
  // Resignation always targets a currently-'active' game, and games' SELECT
  // RLS denies active rows entirely (#12) — which also gates UPDATE, since
  // Postgres requires a row to pass a table's SELECT policy before UPDATE
  // can see it. So this goes through a security-definer RPC rather than a
  // direct .update().
  const { data, error } = await supabase.rpc('end_own_game', {
    p_game_id: gameId,
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
