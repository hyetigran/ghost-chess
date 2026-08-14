import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '~/components/ui';

export type QueueFilter = 'your-turn' | 'waiting' | 'finished';

type Props = {
  filter: QueueFilter;
  onChange: (filter: QueueFilter) => void;
  yourTurnCount: number;
  waitingCount: number;
};

const PILLS: { key: QueueFilter; label: (count: number) => string }[] = [
  { key: 'your-turn', label: (n) => `Your turn · ${n}` },
  { key: 'waiting', label: (n) => `Waiting · ${n}` },
  { key: 'finished', label: () => 'Finished' },
];

// Mockup filter row: the active pill is solid ink with bg-colored text;
// inactive pills are card-colored with a 1px border.
export function GameFilterPills({
  filter,
  onChange,
  yourTurnCount,
  waitingCount,
}: Props): React.JSX.Element {
  const counts: Record<QueueFilter, number> = {
    'your-turn': yourTurnCount,
    waiting: waitingCount,
    finished: 0,
  };

  return (
    <View className='flex-row gap-2'>
      {PILLS.map((pill) => {
        const isActive = filter === pill.key;
        return (
          <Pressable
            key={pill.key}
            onPress={() => onChange(pill.key)}
            className={`px-[15px] py-2 rounded-pill ${
              isActive ? 'bg-foreground' : 'bg-card border border-border'
            }`}
          >
            <Text
              className={
                isActive
                  ? 'font-sans-bold text-[13px] text-background'
                  : 'font-sans-semibold text-[13px] text-muted-foreground'
              }
            >
              {pill.label(counts[pill.key])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
