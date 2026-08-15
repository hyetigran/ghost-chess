import { secondsUntilDeadline, type TimeControlHours } from '~/lib/game/deadline';
import { isViewersTurn } from '~/lib/game/viewer-turn';

type OrderableGame = {
  status: string;
  current_turn: 'white' | 'black';
  white_player_id: string | null;
  updated_at: string;
  time_control_hours: TimeControlHours;
};

// Home's "Your move" list (#83) is a single horizontal row of in-progress
// games only — open 'waiting' seats (no opponent, no running clock) belong
// on new-game's open-invitations list instead, and finished games have
// their own history surface (interim: the Finished pill, see #84) — so
// both get filtered out here rather than left for the caller to remember.
//
// Within that active set, whoever is on the clock matters more than whose
// clock is closer to running out: every your-turn game sorts ahead of
// every waiting-on-opponent game, and each of those two groups is
// internally ordered by soonest deadline first (secondsUntilDeadline
// ascending), so the single most urgent thing to do is always leftmost.
export function orderActiveGames<T extends OrderableGame>(
  games: T[],
  viewerId: string,
  now: Date = new Date(),
): T[] {
  const active = games.filter((g) => g.status === 'active');

  const bySoonestDeadline = (a: T, b: T) =>
    secondsUntilDeadline(a.updated_at, a.time_control_hours, now) -
    secondsUntilDeadline(b.updated_at, b.time_control_hours, now);

  const yourTurn = active
    .filter((g) => isViewersTurn(g.current_turn, g.white_player_id, viewerId))
    .sort(bySoonestDeadline);

  const waitingOnOpponent = active
    .filter((g) => !isViewersTurn(g.current_turn, g.white_player_id, viewerId))
    .sort(bySoonestDeadline);

  return [...yourTurn, ...waitingOnOpponent];
}
