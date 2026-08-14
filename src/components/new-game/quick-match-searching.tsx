import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Progress, Text } from '~/components/ui';
import { useMatchmaking } from '~/context/matchmaking-context';
import { matchmakingBand } from '~/lib/game/matchmaking-band';
import { formatTime } from '~/lib/utils/time';
import { timeControlLabel } from '~/lib/game/time-control-label';
import { gameRoute } from '~/lib/navigation/game-route';
import type { GameSettings } from '~/types/database';

// The widening band never stops growing, so the bar shows progress
// through one 15s widening step and loops — motion that matches what the
// caption ("WIDENING RANGE") says is happening, mockup pairing screen.
const WIDEN_STEP_SECONDS = 15;

type Props = {
  timeControlHours: GameSettings['timeControlHours'];
};

// Reads matchmaking state from MatchmakingProvider (src/context/matchmaking-context.tsx)
// rather than polling on its own — the search itself no longer depends on
// this screen staying mounted (#73), so leaving it (back button, app
// backgrounded) doesn't cancel anything; it just stops watching. Registers
// itself as the active searching screen so the provider skips its own
// "match found" banner in favor of this screen's direct navigation below.
export function QuickMatchSearching({ timeControlHours }: Props): React.JSX.Element {
  const router = useRouter();
  const { entry, isLeaving, leave, setSearchScreenActive } = useMatchmaking();

  React.useEffect(() => {
    setSearchScreenActive(true);
    return () => setSearchScreenActive(false);
  }, [setSearchScreenActive]);

  // Only used to force a re-render every second so the elapsed-time and
  // band indicators visibly tick — the elapsed value itself is derived
  // from entry.joined_at (the server's real timestamp), not counted
  // locally, so it can't drift from what run_matchmaking_sweep is
  // actually widening against.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (entry?.matched_game_id) {
      router.replace(gameRoute(entry.matched_game_id));
    }
  }, [entry?.matched_game_id, router]);

  const elapsedSeconds = entry?.joined_at
    ? Math.max(0, Math.floor((now - new Date(entry.joined_at).getTime()) / 1000))
    : 0;
  const band = matchmakingBand(elapsedSeconds);
  const stepProgress =
    ((elapsedSeconds % WIDEN_STEP_SECONDS) / WIDEN_STEP_SECONDS) * 100;

  return (
    <View className='flex-1 bg-background'>
      <View className='flex-1 items-center justify-center gap-[26px] px-8'>
        {/* Mockup pairing hero: 132px circle, accent knight, inner
            accent-tint ring. */}
        <View className='w-[132px] h-[132px] items-center justify-center rounded-full bg-card border-2 border-accent shadow-card'>
          <Text className='text-[54px] leading-[64px] text-primary'>♞</Text>
        </View>
        <View className='items-center gap-2'>
          <Text className='font-sans-extrabold text-[26px] tracking-[-0.52px]'>
            Finding a match
          </Text>
          <Text className='text-[15px] text-muted-foreground text-center'>
            {timeControlLabel(timeControlHours)} · rated{'\n'}Searching ±{band}{' '}
            rating
          </Text>
        </View>
        <View className='w-full gap-2.5'>
          <Progress value={stepProgress} />
          <View className='flex-row justify-between'>
            <Text className='font-mono text-xs text-faint'>
              {formatTime(elapsedSeconds)}
            </Text>
            <Text className='font-mono text-xs text-faint'>WIDENING RANGE</Text>
          </View>
        </View>
      </View>
      <View className='px-5 pb-9'>
        <Button variant='outline' disabled={isLeaving} onPress={leave}>
          <Text>Cancel search</Text>
        </Button>
      </View>
    </View>
  );
}
