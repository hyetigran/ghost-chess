import { supabase } from '~/api/supabase/client';
import { matchmakingQueueEntrySchema, type GameSettings } from '~/types/database';

/**
 * Joins the auto-pairing queue for a time control (join_matchmaking_queue
 * RPC, #34) — idempotent for a repeat call at the same time control
 * (returns the existing search unchanged), rejected if already searching
 * a different one. Attempts an immediate opportunistic pair server-side;
 * the returned row's matched_game_id is non-null when that succeeds, null
 * when the caller is now just waiting for run_matchmaking_sweep's next
 * pass or another player to join.
 */
export async function joinMatchmakingQueue(
  timeControlHours: GameSettings['timeControlHours'],
) {
  const { data, error } = await supabase.rpc('join_matchmaking_queue', {
    p_time_control_hours: timeControlHours,
  });

  if (error) throw error;
  return matchmakingQueueEntrySchema.parse(data);
}

/** Leaves the queue (leave_matchmaking_queue RPC) — idempotent, safe to
 * call even if already matched or never queued. */
export async function leaveMatchmakingQueue(): Promise<void> {
  const { error } = await supabase.rpc('leave_matchmaking_queue');
  if (error) throw error;
}

/**
 * The caller's own queue status (get_matchmaking_status RPC) — also the
 * heartbeat run_matchmaking_sweep's stale-row cleanup relies on, so this
 * is meant to be polled while the caller is actually on the searching
 * screen (matchmakingQueries.status, src/lib/state/matchmaking/queries.ts),
 * not called once and cached. Returns null when the caller isn't
 * currently queued at all — verified directly against a live local
 * instance that this arrives as `{user_id: null, ...}` (every column
 * null), not a bare JSON null, despite the underlying SQL function
 * returning a genuinely null public.matchmaking_queue composite;
 * PostgREST's RPC serialization doesn't collapse an all-null row down to
 * a bare null the way a plain to_json() call would.
 */
export async function getMatchmakingStatus() {
  const { data, error } = await supabase.rpc('get_matchmaking_status');

  if (error) throw error;
  if (!data || data.user_id === null) return null;
  return matchmakingQueueEntrySchema.parse(data);
}
