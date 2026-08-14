import { queryOptions } from '@tanstack/react-query';
import { getMatchmakingStatus } from '~/api/server/matchmaking';

// A relaxed app-wide poll, not a screen-tied heartbeat (#73) — search
// survival no longer depends on this being called (run_matchmaking_sweep
// expires unmatched entries on a joined_at TTL instead), so this exists
// purely to keep the client's own view of "am I searching / matched" in
// sync, from wherever MatchmakingProvider (src/context/matchmaking-context.tsx)
// is mounted, not tied to any particular screen being open.
export const matchmakingQueries = {
  status: (viewerId: string) =>
    queryOptions({
      queryKey: ['matchmaking', 'status', viewerId],
      queryFn: () => getMatchmakingStatus(),
      enabled: !!viewerId,
      refetchInterval: 20000,
    }),
};
