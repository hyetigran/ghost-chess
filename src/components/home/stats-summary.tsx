import * as React from 'react';
import { View } from 'react-native';
import { Text } from '~/components/ui';
import { winRatePercent } from '~/lib/game/win-rate';

type Props = {
  wins: number;
  losses: number;
  draws: number;
  eloRating: number;
};

export function StatsSummary({
  wins,
  losses,
  draws,
  eloRating,
}: Props): React.JSX.Element {
  return (
    <View className='flex-row justify-between'>
      <Stat label='Elo' value={eloRating} />
      <Stat label='Wins' value={wins} />
      <Stat label='Losses' value={losses} />
      <Stat label='Draws' value={draws} />
      <Stat label='Win rate' value={`${winRatePercent(wins, losses, draws)}%`} />
    </View>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}): React.JSX.Element {
  return (
    <View className='items-center'>
      <Text className='text-lg font-semibold'>{value}</Text>
      <Text className='text-xs text-muted-foreground'>{label}</Text>
    </View>
  );
}
