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
 */
export async function getActiveGames(
  userId: string,
): Promise<ActiveGamesResponse['data']> {
  const { data, error } = await supabase
    .from('games')
    .select(
      `
      id,
      white_player_id,
      black_player_id,
      status,
      current_turn,
      fen,
      white_time_remaining,
      black_time_remaining,
      created_at
    `,
    )
    .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return z.array(activeGameSchema).parse(data);
}

/**
 * Get user's game history
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
      pgn,
      created_at
    `,
    )
    .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
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
