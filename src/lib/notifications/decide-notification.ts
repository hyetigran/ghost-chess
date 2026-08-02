export type Color = 'white' | 'black';
export type GameStatus = 'waiting' | 'active' | 'completed' | 'abandoned';

export type GameChangeSnapshot = {
  id: string;
  status: GameStatus;
  white_player_id: string | null;
  black_player_id: string | null;
  current_turn: Color;
  result: string | null;
};

export type NotificationEvent =
  | { type: 'invitation_accepted'; recipientId: string; gameId: string }
  | { type: 'your_turn'; recipientId: string; gameId: string }
  | { type: 'game_completed'; recipientId: string; gameId: string };

// Mirrors notify_game_change() (supabase/schemas/06_functions.sql) — that
// trigger is the actual enforcement point (fires inside the same
// transaction as every games UPDATE), this is a readable, independently
// testable reference for the same decision, per this repo's established
// dual-implementation pattern (decide-move.ts, redact-fen.ts).
//
// "Game invitations" (PRD §4.4) has no invitee to notify in this app's
// model — invites are game-ID shares to nobody-in-particular (ADR-0005),
// not records naming a specific recipient — so this notifies the
// *creator* that their invite was accepted instead, the only side of
// "invitation" this data model can actually name a recipient for.
export function decideGameChangeNotifications(
  previous: GameChangeSnapshot,
  next: GameChangeSnapshot,
): NotificationEvent[] {
  const events: NotificationEvent[] = [];

  const becameActive = previous.status === 'waiting' && next.status === 'active';
  if (becameActive) {
    const creatorId = previous.white_player_id ?? previous.black_player_id;
    if (creatorId) {
      events.push({
        type: 'invitation_accepted',
        recipientId: creatorId,
        gameId: next.id,
      });
    }
  }

  const becameTerminal =
    (next.status === 'completed' || next.status === 'abandoned') &&
    previous.status !== next.status;

  if (becameTerminal) {
    for (const recipientId of [next.white_player_id, next.black_player_id]) {
      if (recipientId) {
        events.push({ type: 'game_completed', recipientId, gameId: next.id });
      }
    }
  } else if (
    next.status === 'active' &&
    (becameActive || previous.current_turn !== next.current_turn)
  ) {
    const recipientId =
      next.current_turn === 'white' ? next.white_player_id : next.black_player_id;
    if (recipientId) {
      events.push({ type: 'your_turn', recipientId, gameId: next.id });
    }
  }

  return events;
}
