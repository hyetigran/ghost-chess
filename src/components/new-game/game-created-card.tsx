import * as React from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
} from '~/components/ui';
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
    <View className='items-center justify-center flex-1 gap-5 p-6 bg-background'>
      <Card className='w-full max-w-sm p-6 rounded-2xl'>
        <CardHeader className='items-center'>
          <CardTitle className='text-2xl font-bold'>
            {variant === 'open' ? 'Invitation posted!' : 'Game created!'}
          </CardTitle>
        </CardHeader>
        <CardContent className='items-center gap-4'>
          <Text className='text-center text-muted-foreground'>
            {variant === 'open'
              ? 'Anyone eligible can now find and accept this from the open invitations list.'
              : 'Share this game ID with your opponent — press and hold to copy.'}
          </Text>
          <Text selectable className='text-lg font-mono text-center'>
            {gameId}
          </Text>
          <Link href={gameRoute(gameId)} asChild>
            <Button className='w-full'>
              <Text>Go to game</Text>
            </Button>
          </Link>
        </CardContent>
      </Card>
    </View>
  );
}
