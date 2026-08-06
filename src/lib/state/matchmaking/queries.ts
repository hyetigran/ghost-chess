import { queryOptions } from '@tanstack/react-query';
import { getMatchmakingStatus } from '~/api/server/matchmaking';

// 3s polling, not realtime (matchmaking_queue is deliberately not
// realtime-published, 10_matchmaking.sql) — the poll also doubles as the
// heartbeat run_matchmaking_sweep's stale-row cleanup relies on, so
// `enabled` should stay tied to whether the caller is actually on the
// searching screen (not just `!!viewerId`, unlike most other queries in
// this codebase) — polling in the background would both waste requests
// and keep a queue entry looking "alive" after the user has navigated
// away without explicitly leaving.
export const matchmakingQueries = {
  status: (viewerId: string, options?: { enabled?: boolean }) =>
    queryOptions({
      queryKey: ['matchmaking', 'status', viewerId],
      queryFn: () => getMatchmakingStatus(),
      enabled: !!viewerId && (options?.enabled ?? true),
      refetchInterval: 3000,
    }),
};
