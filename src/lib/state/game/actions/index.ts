import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Chess } from 'chess.js';
import { createGame, endGame, submitMove } from '~/api/server/game';
import { useAuth } from '~/context/auth-context';
import { GameSettings, PlayerView } from '~/types/database';

export const useMakeMove = ({ gameId }: { gameId: string }) => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({
      from,
      to,
      promotion,
    }: {
      from: string;
      to: string;
      promotion?: string;
    }) => {
      if (!userId) throw new Error('User not authenticated');
      return submitMove(gameId, from, to, promotion);
    },
    onMutate: async (newMove) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['game', gameId] });

      // Snapshot the previous value
      const previousGame = queryClient.getQueryData<PlayerView>([
        'game',
        gameId,
      ]);

      // Optimistically apply the move locally for a snappy UI, built from
      // the mover's own redacted_fen (never the true games.fen — this
      // client never reads that while a game is active, per #12), which is
      // exactly what the mover is legitimately allowed to construct: their
      // own move against their own known pieces. The server (submitMove
      // above) is still the sole source of truth — if this move turns out
      // to be illegal (including one targeting a hidden opponent piece,
      // which this client can't know about), onError rolls this back and
      // the server's rejection is the real answer. Clocks aren't touched
      // here: submitMove doesn't take a client-computed gameState (ADR-0001
      // — the server owns clock computation entirely), so onSettled's
      // refetch is what picks up the real values.
      if (previousGame) {
        try {
          // skipValidation: a redacted FEN structurally omits the
          // opponent's king (redact_fen, supabase/schemas/06_functions.sql)
          // — chess.js's default strict validation throws on that for
          // any real active game, which this try/catch was silently
          // swallowing every time (indistinguishable from the "illegal
          // move" catch case below) rather than actually applying the
          // optimistic update.
          const chess = new Chess(previousGame.redacted_fen, {
            skipValidation: true,
          });
          chess.move({
            from: newMove.from,
            to: newMove.to,
            promotion: newMove.promotion,
          });

          queryClient.setQueryData(['game', gameId], {
            ...previousGame,
            redacted_fen: chess.fen(),
            current_turn:
              previousGame.current_turn === 'white' ? 'black' : 'white',
          } satisfies PlayerView);
        } catch {
          // chess.js throws on an illegal move (e.g. one targeting a
          // hidden opponent piece, which this client can't know about) —
          // nothing to optimistically apply, just let the server respond.
        }
      }

      return { previousGame };
    },
    onError: (err, newMove, context) => {
      // Rollback to the previous value
      if (context?.previousGame) {
        queryClient.setQueryData(['game', gameId], context.previousGame);
      }
      // Not surfaced in the UI yet (no toast/notification system exists) —
      // logged so a rejection isn't completely silent. `err.code` is
      // deliberately generic ("illegal_move") for anything board-related,
      // per ADR-0007; this is a debugging aid, not user-facing copy.
      console.warn('move rejected:', err instanceof Error ? err.message : err);
    },
    onSettled: () => {
      // Refetch the game to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });
};

export const useEndGame = ({ gameId }: { gameId: string }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => endGame(gameId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });
};

export const useCreateGame = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  console.log('here', userId);
  return useMutation({
    mutationFn: ({ settings }: { settings: GameSettings }) => {
      if (!userId) throw new Error('User not authenticated');
      return createGame(userId, settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game'] });
    },
  });
};
