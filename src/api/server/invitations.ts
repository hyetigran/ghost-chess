import { Chess } from 'chess.js';
import { supabase } from '~/api/supabase/client';
import { z } from 'zod';
import {
  myOpenInvitationSchema,
  openInvitationSchema,
  type GameSettings,
  type MyOpenInvitation,
  type OpenInvitation,
} from '~/types/database';

/**
 * Post an open invitation: a 'waiting' game like createGame's existing
 * private-link flow (src/api/server/game.ts), but discoverable — the
 * settings.isPrivate/invitation_min_rating/invitation_max_rating that
 * make it findable via get_open_invitations() are the only difference.
 * No separate insert path: an open invitation is still just a
 * one-slot-null games row, the exact same shape createGame already
 * produces, so reusing it here (rather than a parallel "invitations"
 * table) avoids a second, divergent game-creation code path.
 */
export async function postOpenInvitation(
  userId: string,
  timeControlHours: GameSettings['timeControlHours'],
  ratingRange: { min: number; max: number } | null,
): Promise<{ id: string }> {
  const isUserWhite = Math.random() < 0.5;

  const { data, error } = await supabase
    .from('games')
    .insert({
      white_player_id: isUserWhite ? userId : null,
      black_player_id: isUserWhite ? null : userId,
      settings: {
        timeControlHours,
        isPrivate: false,
        allowTakebacks: false,
      },
      status: 'waiting',
      current_turn: 'white',
      fen: new Chess().fen(),
      pgn: '',
      invitation_min_rating: ratingRange?.min ?? null,
      invitation_max_rating: ratingRange?.max ?? null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return z.object({ id: z.string().uuid() }).parse(data);
}

/**
 * Other players' open invitations, available to accept — join_game
 * (already used for the private-link flow) is still the accept call;
 * this is only the browse read. get_open_invitations() (security
 * definer, supabase/schemas/08_functions.sql) already excludes the
 * caller's own invitations and joins in the poster's username/
 * elo_rating, which a raw client-side query against `games` couldn't do
 * (public.users' SELECT RLS is own-row-only).
 */
export async function getOpenInvitations(): Promise<OpenInvitation[]> {
  const { data, error } = await supabase.rpc('get_open_invitations');

  if (error) throw error;
  return z.array(openInvitationSchema).parse(data);
}

/** The caller's own posted-and-still-open invitations, for a cancel list. */
export async function getMyOpenInvitations(): Promise<MyOpenInvitation[]> {
  const { data, error } = await supabase.rpc('get_my_open_invitations');

  if (error) throw error;
  return z.array(myOpenInvitationSchema).parse(data);
}

/** Withdraws an invitation the caller posted (cancel_own_invitation RPC). */
export async function cancelInvitation(gameId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_own_invitation', {
    p_game_id: gameId,
  });

  if (error) throw error;
}
