import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Link } from 'expo-router';
import { Text } from '~/components/ui';
import { BoardThumbnail } from '~/components/home/board-thumbnail';
import { secondsUntilDeadline } from '~/lib/game/deadline';
import { formatTimeRemaining } from '~/lib/game/format-time-remaining';
import { gameRoute } from '~/lib/navigation/game-route';
import { orderActiveGames } from '~/lib/game/order-active-games';
import { urgencyTier } from '~/lib/game/urgency';
import { isViewersTurn } from '~/lib/game/viewer-turn';
import { formatUsername } from '~/lib/user/format-username';
import type { ActiveGame } from '~/types/database';

type Props = {
  games: ActiveGame[];
  viewerId: string;
};

// Home's "Your move" section (#83): a single horizontal, swipeable strip
// of in-progress games — replaces the old GameFilterPills + vertical
// GameQueueList combo entirely for this section. orderActiveGames does
// the filtering (active only — no open 'waiting' seats, no finished
// games) and ordering (your-turn first, then waiting-on-opponent, each by
// soonest deadline); this component is just presentation.
export function ActiveGamesList({ games, viewerId }: Props): React.JSX.Element {
  const ordered = React.useMemo(
    () => orderActiveGames(games, viewerId),
    [games, viewerId],
  );

  if (ordered.length === 0) {
    return (
      <Text className='text-sm text-muted-foreground'>
        No games in progress.
      </Text>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // .scrollbar-hide (global.css, added by #81 for exactly this list)
      // hides the web scrollbar chrome so this reads as a swipeable card
      // strip rather than a document with a visible rail. No-op on
      // native — there's no CSSOM there for the class to hook into.
      className='scrollbar-hide'
      contentContainerClassName='gap-2.5 pr-5'
    >
      {ordered.map((game) => (
        <ActiveGameCard key={game.game_id} game={game} viewerId={viewerId} />
      ))}
    </ScrollView>
  );
}

function ActiveGameCard({
  game,
  viewerId,
}: {
  game: ActiveGame;
  viewerId: string;
}): React.JSX.Element {
  const viewerColor = game.white_player_id === viewerId ? 'white' : 'black';
  const opponentUsername =
    viewerColor === 'white' ? game.black_username : game.white_username;

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

  return (
    <Link href={gameRoute(game.game_id)} asChild>
      <Pressable
        className={`w-[132px] gap-2 px-3 py-3 bg-card rounded-control border border-border shadow-card ${
          tier === 'critical' ? 'border-l-[3px] border-l-danger' : ''
        }`}
      >
        <BoardThumbnail
          redactedFen={game.redacted_fen}
          orientation={viewerColor}
          size={40}
        />
        <View className='gap-0.5'>
          <Text numberOfLines={1} className='font-sans-bold text-[13px]'>
            {opponentUsername ? formatUsername(opponentUsername) : 'Opponent'}
          </Text>
          <View className='flex-row items-center gap-1'>
            <Text
              className={`font-mono-semibold text-xs ${
                tier === 'critical'
                  ? 'text-danger'
                  : tier === 'warning'
                    ? 'text-highlight'
                    : isYourTurn
                      ? 'text-primary'
                      : 'text-muted-foreground'
              }`}
            >
              {formatTimeRemaining(secondsLeft)}
            </Text>
            <Text className='font-mono-semibold text-[9px] text-faint'>
              LEFT
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
