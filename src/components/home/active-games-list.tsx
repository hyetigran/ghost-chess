import * as React from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import { Button, Text } from '~/components/ui';
import type { ActiveGame } from '~/types/database';

type Props = {
  games: ActiveGame[];
  viewerId: string;
};

export function ActiveGamesList({ games, viewerId }: Props): React.JSX.Element {
  if (games.length === 0) {
    return (
      <Text className='text-sm text-muted-foreground'>
        No active games — start one above.
      </Text>
    );
  }

  return (
    <View className='gap-2'>
      {games.map((game) => {
        const viewerColor = game.white_player_id === viewerId ? 'white' : 'black';
        const isYourTurn = game.current_turn === viewerColor;

        return (
          <Link
            key={game.game_id}
            href={{ pathname: '/(game)/[id]/page', params: { id: game.game_id } }}
            asChild
          >
            <Button variant={isYourTurn ? 'default' : 'outline'} className='justify-between'>
              <Text>{isYourTurn ? 'Your turn' : "Opponent's turn"}</Text>
            </Button>
          </Link>
        );
      })}
    </View>
  );
}
