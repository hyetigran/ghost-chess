export type NotificationKind =
  | 'invitation_accepted'
  | 'your_turn'
  | 'game_completed'
  | 'time_warning';

export type NotificationCopy = {
  title: string;
  body: string;
};

// Mirrors the hardcoded strings inside notify_game_change() and
// send_time_warnings() (supabase/schemas/06_functions.sql) — those SQL
// functions are the actual enforcement point (the real send happens
// there, via pg_net), this is the tested, readable reference, same
// dual-implementation pattern as decide-move.ts/redact-fen.ts. Nothing
// in the client calls this today: notification text is generated
// entirely server-side and arrives pre-formed in the push payload, so
// there's no client code path that needs to construct it. Kept here
// anyway (not deleted as dead code) so the two copies of this copy stay
// checkable against each other — if a string changes on one side without
// the other, this file's own test suite is the thing that would need
// updating too, forcing the drift to be noticed.
//
// Kept deliberately generic — never names an opponent, a color, or a
// result. The push payload's content is public (delivered through
// Apple/Google's infrastructure, potentially shown on a lock screen), so
// anything occlusion-sensitive has no business being in it; the app
// itself is the only place that should ever say who won or what happened.
export function notificationCopy({
  type,
}: {
  type: NotificationKind;
}): NotificationCopy {
  switch (type) {
    case 'invitation_accepted':
      return {
        title: 'Opponent found!',
        body: 'Someone joined your game — it starts now.',
      };
    case 'your_turn':
      return {
        title: 'Your turn',
        body: "It's your move.",
      };
    case 'game_completed':
      return {
        title: 'Game over',
        body: 'Your game has ended — tap to see how it finished.',
      };
    case 'time_warning':
      return {
        title: 'Time is running out',
        body: "You're close to your move deadline in an active game.",
      };
  }
}
