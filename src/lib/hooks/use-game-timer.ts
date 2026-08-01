import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PlayerView } from '~/types/database';
import { secondsUntilDeadline } from '~/lib/game/deadline';

// Per-move deadlines (docs/adr/0006) have exactly one relevant countdown
// at any moment — whoever's turn it currently is — fully derived from
// player_views' updated_at/current_turn/time_control_hours, so unlike the
// old cumulative-clock version of this hook there's nothing to write back
// into the query cache: this just forces a re-render every second so the
// derived value stays current, and returns it directly.
export function useGameTimer(gameId: string): {
  activeColor: 'white' | 'black';
  secondsRemaining: number;
} | null {
  const queryClient = useQueryClient();
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const game = queryClient.getQueryData<PlayerView>(['game', gameId]);
  if (!game || game.status !== 'active') return null;

  return {
    activeColor: game.current_turn,
    secondsRemaining: secondsUntilDeadline(
      game.updated_at,
      game.time_control_hours,
    ),
  };
}
