export type NotificationKind =
  | 'invitation_accepted'
  | 'your_turn'
  | 'game_completed'
  | 'time_warning';

export type NotificationCopy = {
  title: string;
  body: string;
};

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
