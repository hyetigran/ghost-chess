import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { showMessage } from 'react-native-flash-message';
import { useAuth } from '~/context/auth-context';
import { gameRoute } from '~/lib/navigation/game-route';
import { matchmakingQueries } from '~/lib/state/matchmaking/queries';
import { useLeaveMatchmakingQueue } from '~/lib/state/matchmaking/actions';
import { userQueries } from '~/lib/state/user/queries';
import type { MatchmakingQueueEntry } from '~/types/database';

type MatchmakingContextType = {
  /** Current queue row, or null if not currently searching/matched. */
  entry: MatchmakingQueueEntry | null;
  /** entry exists and hasn't been paired yet. */
  isSearching: boolean;
  isLeaving: boolean;
  leave: () => void;
  /**
   * QuickMatchSearching calls this in a mount effect so the provider can
   * tell "the searching screen is showing this match" (its own effect
   * handles navigation, no banner needed) apart from "the match happened
   * while the user was elsewhere" (banner + activeGames refresh needed).
   */
  setSearchScreenActive: (active: boolean) => void;
};

const MatchmakingContext = React.createContext<MatchmakingContextType>({
  entry: null,
  isSearching: false,
  isLeaving: false,
  leave: () => {},
  setSearchScreenActive: () => {},
});

// App-wide matchmaking awareness (#73) — a search used to only exist as
// long as QuickMatchSearching stayed mounted (its 3s poll was the sole
// heartbeat keeping the queue row alive). Pairing and the "Match found!"
// push were already screen-independent (run_matchmaking_sweep's cron,
// pair_queue_entries's own push send); only the client's own knowledge of
// "am I searching" was tied to one screen. Mounted once at the app root
// (Providers, src/app/_layout.tsx) so any screen — home, a game, settings
// — can show "still searching" state and react when a match lands.
export function MatchmakingProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data } = useQuery(matchmakingQueries.status(userId ?? ''));
  const entry = data ?? null;
  const isSearching = !!entry && entry.matched_game_id == null;

  const { mutate: leaveMutation, isPending: isLeaving } =
    useLeaveMatchmakingQueue();
  // Distinguishes "the search ended because the user cancelled it" (no
  // message needed, they already know) from "the search just vanished"
  // (TTL expiry, or a second device leaving the queue) — only the latter
  // needs a toast, and only leave() below can tell the difference.
  const intentionalLeaveRef = React.useRef(false);
  const leave = React.useCallback(() => {
    intentionalLeaveRef.current = true;
    leaveMutation();
  }, [leaveMutation]);

  const searchScreenActiveRef = React.useRef(false);
  const setSearchScreenActive = React.useCallback((active: boolean) => {
    searchScreenActiveRef.current = active;
  }, []);

  // Match detected: banner + refresh the home queue, but only if nobody's
  // already looking at the searching screen — that screen's own effect
  // (QuickMatchSearching) handles navigating straight into the game, and
  // showing a banner on top of a screen already mid-transition would just
  // be noise.
  const prevMatchedIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const matchedId = entry?.matched_game_id ?? null;
    if (matchedId && matchedId !== prevMatchedIdRef.current) {
      if (!searchScreenActiveRef.current) {
        if (userId) {
          queryClient.invalidateQueries({
            queryKey: userQueries.activeGames(userId).queryKey,
          });
        }
        showMessage({
          message: 'Match found!',
          description: 'Tap to jump into your new game.',
          type: 'success',
          onPress: () => router.push(gameRoute(matchedId)),
        });
      }
    }
    prevMatchedIdRef.current = matchedId;
  }, [entry?.matched_game_id, queryClient, router, userId]);

  // Search vanished without the user asking it to (TTL expiry, or a
  // duplicate leave from elsewhere) — surface it once rather than the
  // home row / searching screen just silently going quiet.
  const wasSearchingRef = React.useRef(false);
  React.useEffect(() => {
    if (wasSearchingRef.current && !entry) {
      if (!intentionalLeaveRef.current) {
        showMessage({
          message: 'Search ended',
          description: 'We stopped looking for a match — try again anytime.',
          type: 'info',
        });
      }
      intentionalLeaveRef.current = false;
    }
    wasSearchingRef.current = isSearching;
  }, [entry, isSearching]);

  return (
    <MatchmakingContext.Provider
      value={{ entry, isSearching, isLeaving, leave, setSearchScreenActive }}
    >
      {children}
    </MatchmakingContext.Provider>
  );
}

export const useMatchmaking = (): MatchmakingContextType =>
  React.useContext(MatchmakingContext);
