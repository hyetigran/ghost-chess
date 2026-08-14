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

// Styled like the mockup's split stat card (the game-over accuracy card):
// one bordered card, hairline dividers, big Manrope 800 values over tiny
// mono uppercase labels.
export function StatsSummary({
  wins,
  losses,
  draws,
  eloRating,
}: Props): React.JSX.Element {
  return (
    <View className='flex-row py-3.5 bg-card border border-border rounded-control shadow-card'>
      <Stat label='Rating' value={eloRating} emphasized />
      <Divider />
      <Stat label='Wins' value={wins} />
      <Divider />
      <Stat label='Losses' value={losses} />
      <Divider />
      <Stat label='Draws' value={draws} />
      <Divider />
      <Stat label='Win %' value={winRatePercent(wins, losses, draws)} />
    </View>
  );
}

function Divider(): React.JSX.Element {
  return <View className='w-px bg-secondary' />;
}

function Stat({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string | number;
  emphasized?: boolean;
}): React.JSX.Element {
  return (
    <View className='flex-1 items-center gap-[3px]'>
      <Text
        className={`font-sans-extrabold text-[22px] ${
          emphasized ? 'text-primary' : 'text-muted-foreground'
        }`}
      >
        {value}
      </Text>
      <Text className='font-mono-semibold text-[10px] uppercase text-faint'>
        {label}
      </Text>
    </View>
  );
}
