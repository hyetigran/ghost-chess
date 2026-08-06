import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
} from '~/components/ui';
import { matchmakingQueries } from '~/lib/state/matchmaking/queries';
import { useLeaveMatchmakingQueue } from '~/lib/state/matchmaking/actions';
import { matchmakingBand } from '~/lib/game/matchmaking-band';
import { formatTime } from '~/lib/utils/time';
import { timeControlLabel } from '~/lib/game/time-control-label';
import { gameRoute } from '~/lib/navigation/game-route';
import type { GameSettings } from '~/types/database';

type Props = {
  viewerId: string;
  timeControlHours: GameSettings['timeControlHours'];
  onCancelled: () => void;
};

export function QuickMatchSearching({
  viewerId,
  timeControlHours,
  onCancelled,
}: Props): React.JSX.Element {
  const router = useRouter();
  const { data: status } = useQuery(matchmakingQueries.status(viewerId));
  const { mutate: leaveQueue, isPending: isLeaving } =
    useLeaveMatchmakingQueue();

  // Only used to force a re-render every second so the elapsed-time and
  // band indicators visibly tick — the elapsed value itself is derived
  // from status.joined_at (the server's real timestamp), not counted
  // locally, so it can't drift from what run_matchmaking_sweep is
  // actually widening against.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (status?.matched_game_id) {
      router.replace(gameRoute(status.matched_game_id));
    }
  }, [status?.matched_game_id, router]);

  const elapsedSeconds = status?.joined_at
    ? Math.max(0, Math.floor((now - new Date(status.joined_at).getTime()) / 1000))
    : 0;
  const band = matchmakingBand(elapsedSeconds);

  return (
    <View className='items-center justify-center flex-1 gap-5 p-6 bg-background'>
      <Card className='w-full max-w-sm p-6 rounded-2xl'>
        <CardHeader className='items-center'>
          <CardTitle className='text-2xl font-bold'>
            Finding a match…
          </CardTitle>
        </CardHeader>
        <CardContent className='items-center gap-4'>
          <Text className='text-center text-muted-foreground'>
            {timeControlLabel(timeControlHours)} · searching within ±{band}{' '}
            rating
          </Text>
          <Text className='font-mono text-3xl'>
            {formatTime(elapsedSeconds)}
          </Text>
          <Button
            variant='outline'
            disabled={isLeaving}
            onPress={() => {
              leaveQueue(undefined, { onSuccess: onCancelled });
            }}
          >
            <Text>Cancel</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
