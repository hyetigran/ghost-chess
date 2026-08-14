import * as React from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import { Button, Text } from '~/components/ui';
import { gameRoute } from '~/lib/navigation/game-route';

type Props = {
  gameId: string;
  /**
   * 'open' when this came from posting a discoverable invitation (#33) —
   * the game id is no longer the primary way someone finds their way in
   * (they'll find it by browsing), so the copy shifts away from "share
   * this" without changing anything structural: it's still the same
   * game-ID-based flow underneath, per ADR-0005.
   */
  variant?: 'private' | 'open';
};

// Game-ID-based invite, per ADR-0005 — the id shown below is the entire
// invite, nothing about the creator's identity is shared alongside it.
export function GameCreatedCard({
  gameId,
  variant = 'private',
}: Props): React.JSX.Element {
  return (
    <View className='flex-1 bg-background'>
      <View className='flex-1 items-center justify-center gap-[22px] px-8'>
        <View className='w-14 h-14 items-center justify-center rounded-control bg-accent'>
          <Text className='text-[26px] leading-8 text-primary'>♟</Text>
        </View>
        <View className='items-center gap-2'>
          <Text className='font-sans-extrabold text-[26px] tracking-[-0.52px] text-center'>
            {variant === 'open' ? 'Invitation posted' : 'Game created'}
          </Text>
          <Text className='text-sm text-muted-foreground text-center'>
            {variant === 'open'
              ? 'Anyone eligible can now find and accept this from the open invitations list.'
              : 'Share this game ID with your opponent — press and hold to copy.'}
          </Text>
        </View>
        <View className='w-full items-center px-4 py-3.5 bg-card border border-border rounded-chip shadow-card'>
          <Text selectable className='font-mono text-base text-center'>
            {gameId}
          </Text>
        </View>
      </View>
      <View className='px-5 pb-9'>
        <Link href={gameRoute(gameId)} asChild>
          <Button>
            <Text>Go to game</Text>
          </Button>
        </Link>
      </View>
    </View>
  );
}
