import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import { Text } from '~/components/ui';
import { BoardThumbnail } from '~/components/home/board-thumbnail';
import { deadlineFor, secondsUntilDeadline } from '~/lib/game/deadline';
import { gameRoute } from '~/lib/navigation/game-route';
import { timeControlLabel } from '~/lib/game/time-control-label';
import { urgencyTier } from '~/lib/game/urgency';
import { isViewersTurn } from '~/lib/game/viewer-turn';
import { formatUsername } from '~/lib/user/format-username';
import type { ActiveGame } from '~/types/database';

type Props = {
  games: ActiveGame[];
  viewerId: string;
};

// Same rich row treatment for both "your turn" and "waiting" filters
// (game-filter-pills.tsx) — a real board thumbnail, opponent identity,
// and an urgency-escalating time-remaining readout. "Finished" reuses
// RecentGamesList's simpler treatment instead (src/app/index.tsx) rather
// than this component: game history (getGameHistory) is sourced from
// `games` directly, not `player_views`, so it doesn't carry the
// denormalized opponent username/rating/redacted_fen this row needs —
// extending it to would mean the same public.users-RLS join problem
// phase 2's get_open_invitations() RPC exists to solve, for a
// lower-value surface (a finished game's result already says who won).
export function GameQueueList({ games, viewerId }: Props): React.JSX.Element {
  if (games.length === 0) {
    return (
      <Text className='text-sm text-muted-foreground'>
        Nothing here right now.
      </Text>
    );
  }

  return (
    <View className='gap-2'>
      {games.map((game) => (
        <GameQueueRow key={game.game_id} game={game} viewerId={viewerId} />
      ))}
    </View>
  );
}

function GameQueueRow({
  game,
  viewerId,
}: {
  game: ActiveGame;
  viewerId: string;
}): React.JSX.Element {
  const viewerColor = game.white_player_id === viewerId ? 'white' : 'black';
  const opponentUsername =
    viewerColor === 'white' ? game.black_username : game.white_username;
  const opponentElo =
    viewerColor === 'white' ? game.black_elo_rating : game.white_elo_rating;

  const isYourTurn = isViewersTurn(
    game.current_turn,
    game.white_player_id,
    viewerId,
  );
  const windowSeconds = game.time_control_hours * 60 * 60;
  const secondsLeft = secondsUntilDeadline(
    game.updated_at,
    game.time_control_hours,
  );
  const tier = isYourTurn ? urgencyTier(secondsLeft, windowSeconds) : 'normal';

  const timeLabel = isYourTurn
    ? formatTimeRemaining(secondsLeft)
    : timeLeftForOpponent(game.updated_at, game.time_control_hours);

  return (
    <Link href={gameRoute(game.game_id)} asChild>
      <Pressable
        className={`flex-row items-center gap-3 p-3 bg-card rounded-control border border-border ${
          tier === 'critical' ? 'border-l-[3px] border-l-danger' : ''
        }`}
      >
        <BoardThumbnail redactedFen={game.redacted_fen} orientation={viewerColor} />
        <View className='flex-1 gap-0.5'>
          <View className='flex-row items-center gap-2'>
            <Text className='text-base font-semibold'>
              {opponentUsername
                ? formatUsername(opponentUsername)
                : 'Waiting for opponent'}
            </Text>
            {opponentElo !== null && (
              <Text className='font-mono text-xs text-muted-foreground'>
                {opponentElo}
              </Text>
            )}
          </View>
          <Text className='text-xs text-muted-foreground'>
            {`You play ${viewerColor} · ${timeControlLabel(game.time_control_hours)}`}
          </Text>
        </View>
        <View className='items-end'>
          <Text
            className={`font-mono text-sm font-semibold ${
              tier === 'critical'
                ? 'text-danger'
                : tier === 'warning'
                  ? 'text-highlight'
                  : 'text-muted-foreground'
            }`}
          >
            {timeLabel}
          </Text>
          <Text className='font-mono text-[9px] text-muted-foreground'>
            LEFT
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

// Opponent's remaining window is shown too (per the design spec's "1d 6h"
// row for a waiting-on-them game), computed the same way as the viewer's
// own — deadlineFor doesn't care whose turn it is, just when the current
// turn started and how long its window is.
function timeLeftForOpponent(
  updatedAt: string,
  timeControlHours: ActiveGame['time_control_hours'],
): string {
  const seconds = secondsUntilDeadline(updatedAt, timeControlHours);
  return formatTimeRemaining(seconds);
}

function formatTimeRemaining(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours >= 1) return `${hours}h ${minutes}m`;
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Re-exported so callers don't need to know deadlineFor lives elsewhere
// just to sort by "most urgent" (src/app/index.tsx's "play next game" CTA).
export function deadlineForGame(game: ActiveGame): Date {
  return deadlineFor(game.updated_at, game.time_control_hours);
}
