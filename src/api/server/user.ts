import { supabase } from '~/api/supabase/client';
import { z } from 'zod';
import type {
  User,
  ActiveGamesResponse,
  GameHistoryResponse,
  LeaderboardResponse,
  OpponentResponse,
} from '~/types/database';
import {
  userSchema,
  activeGameSchema,
  gameHistorySchema,
  leaderboardUserSchema,
  opponentSchema,
} from '~/types/database';

/**
 * Get user profile
 */
export async function getUserProfile(userId: string): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return userSchema.parse(data);
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<User, 'username' | 'email'>>,
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return userSchema.parse(data);
}

/**
 * Register (or clear, with null) this device's Expo push token (#29).
 * A plain client update is fine here — unlike `games`, `users` RLS grants
 * an authenticated user UPDATE on their own row with no column
 * restriction, so no security-definer function is needed.
 */
export async function updatePushToken(
  userId: string,
  token: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ push_token: token })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Get user statistics
 */
export async function getUserStats(
  userId: string,
): Promise<Pick<User, 'wins' | 'losses' | 'draws' | 'elo_rating'>> {
  const { data, error } = await supabase
    .from('users')
    .select('wins, losses, draws, elo_rating')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return userSchema
    .pick({ wins: true, losses: true, draws: true, elo_rating: true })
    .parse(data);
}

/**
 * Get user's active games
 *
 * Reads player_views, not games directly (#12) — games' SELECT RLS denies
 * active-status rows entirely, and even if it didn't, an active-games list
 * must never carry the true fen. player_views already has redacted state,
 * both player IDs, and is scoped to the caller's own row by RLS.
 */
export async function getActiveGames(
  userId: string,
): Promise<ActiveGamesResponse['data']> {
  const { data, error } = await supabase
    .from('player_views')
    .select(
      `
      game_id,
      white_player_id,
      black_player_id,
      white_username,
      white_elo_rating,
      black_username,
      black_elo_rating,
      status,
      current_turn,
      time_control_hours,
      redacted_fen,
      updated_at
    `,
    )
    .eq('player_id', userId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return z.array(activeGameSchema).parse(data);
}

/**
 * Get user's game history
 *
 * Restricted to terminal states (completed/abandoned) — 'waiting' and
 * 'active' games have no result yet, so describeGameResult would render
 * a game that hasn't finished (or hasn't even started) as "Game over."
 */
export async function getGameHistory(
  userId: string,
  limit = 10,
  offset = 0,
): Promise<GameHistoryResponse['data']> {
  const { data, error } = await supabase
    .from('games')
    .select(
      `
      id,
      white_player_id,
      black_player_id,
      status,
      result,
      winner_id,
      pgn,
      created_at
    `,
    )
    .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
    .in('status', ['completed', 'abandoned'])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return z.array(gameHistorySchema).parse(data);
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(
  limit = 100,
): Promise<LeaderboardResponse['data']> {
  const { data, error } = await supabase
    .from('users')
    .select(
      `
      id,
      username,
      elo_rating,
      wins,
      losses,
      draws
    `,
    )
    .order('elo_rating', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return z.array(leaderboardUserSchema).parse(data);
}

/**
 * Find opponent for matchmaking
 */
export async function findOpponent(
  userId: string,
  eloRange = 200,
): Promise<OpponentResponse['data']> {
  const user = await getUserProfile(userId);

  const { data, error } = await supabase
    .from('users')
    .select('id, username, elo_rating')
    .neq('id', userId)
    .gte('elo_rating', user.elo_rating - eloRange)
    .lte('elo_rating', user.elo_rating + eloRange)
    .order('elo_rating', { ascending: false })
    .limit(1)
    .single();

  if (error) throw error;
  return opponentSchema.parse(data);
}
