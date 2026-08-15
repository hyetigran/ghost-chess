import { secondsUntilDeadline, type TimeControlHours } from '~/lib/game/deadline';
import { urgencyTier, type UrgencyTier } from '~/lib/game/urgency';
import { isViewersTurn } from '~/lib/game/viewer-turn';

type UrgencyInput = {
  current_turn: 'white' | 'black';
  white_player_id: string | null;
  updated_at: string;
  time_control_hours: TimeControlHours;
};

// Urgency only tracks the viewer's own clock — an opponent's deadline
// ticking down isn't something the viewer needs to act on, so it's always
// 'normal' regardless of how close it actually is. Extracted (#83 review)
// so home's "N EXPIRING" badge count (src/app/index.tsx) and the
// per-card accent border (ActiveGameCard, active-games-list.tsx) derive
// the same tier the same way instead of each re-deriving windowSeconds
// and calling urgencyTier separately.
export function gameUrgencyTier(
  game: UrgencyInput,
  viewerId: string,
  now: Date = new Date(),
): UrgencyTier {
  if (!isViewersTurn(game.current_turn, game.white_player_id, viewerId)) {
    return 'normal';
  }
  const windowSeconds = game.time_control_hours * 60 * 60;
  const secondsLeft = secondsUntilDeadline(
    game.updated_at,
    game.time_control_hours,
    now,
  );
  return urgencyTier(secondsLeft, windowSeconds);
}
