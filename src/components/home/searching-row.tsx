import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import { Button, Text } from '~/components/ui';
import { useMatchmaking } from '~/context/matchmaking-context';
import { matchmakingBand } from '~/lib/game/matchmaking-band';
import { timeControlLabel } from '~/lib/game/time-control-label';

// Home-screen surface for a quick-match search that's running in the
// background (#73) — the whole point of the feature is that leaving the
// searching screen doesn't cancel it, so there needs to be somewhere on
// home that shows it's still going and offers a way back in or out.
// Mirrors invitations.tsx's dashed "Your invitations" card (same
// "pending, not yet a real game" visual language, same non-nested
// tappable-region + separate Cancel button shape, which avoids relying on
// React Native's unreliable nested-Pressable tap resolution).
export function SearchingRow(): React.JSX.Element | null {
  const { entry, isSearching, isLeaving, leave } = useMatchmaking();

  // Only re-rendered for the band figure below, which is coarse (widens
  // every 15s) — a full elapsed-seconds ticker belongs to the dedicated
  // searching screen, not this summary row.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!isSearching) return;
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, [isSearching]);

  if (!isSearching || !entry) return null;

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - new Date(entry.joined_at).getTime()) / 1000),
  );
  const band = matchmakingBand(elapsedSeconds);

  return (
    <View className='flex-row items-center gap-3 border border-dashed border-borderStrong rounded-control px-3.5 py-3.5'>
      <Link href='/new-game' asChild>
        <Pressable className='flex-1 flex-row items-center gap-3'>
          <View className='w-[38px] h-[38px] items-center justify-center rounded-tile bg-accent'>
            <Text className='text-lg text-primary'>♞</Text>
          </View>
          <View className='flex-1 gap-0.5'>
            <Text className='font-sans-bold text-[15px]'>
              Searching for a match
            </Text>
            <Text className='text-xs text-muted-foreground'>
              {timeControlLabel(entry.time_control_hours)} · rated · ±{band}{' '}
              rating
            </Text>
          </View>
        </Pressable>
      </Link>
      <Button size='sm' variant='ghost' disabled={isLeaving} onPress={leave}>
        <Text className='text-danger'>Cancel</Text>
      </Button>
    </View>
  );
}
