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
            className={`px-4 py-2 rounded-pill ${
              isActive ? 'bg-primary' : 'bg-card border border-border'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                isActive
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {pill.label(counts[pill.key])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
