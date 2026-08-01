import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Chess } from 'chess.js';
import { createGame, endGame, submitMove } from '~/api/server/game';
import { useAuth } from '~/context/auth-context';
import { Game, GameResult, GameSettings } from '~/types/database';

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
      const previousGame = queryClient.getQueryData<Game>(['game', gameId]);

      // Optimistically apply the move locally for a snappy UI. The server
      // is still the sole source of truth (submitMove above) — if this
      // move turns out to be illegal (including one targeting a hidden
      // opponent piece, which this client can't know about), onError rolls
      // this back and the server's rejection is the real answer.
      if (previousGame) {
        try {
          const chess = new Chess(previousGame.fen);
          chess.move({
            from: newMove.from,
            to: newMove.to,
            promotion: newMove.promotion,
          });

          // Not touching pgn: `chess` was constructed from just the FEN,
          // so it has no move history — chess.pgn() here would return a
          // one-move PGN and clobber previousGame's real history in the
          // cache until onSettled's refetch overwrites it. The server
          // owns this field; leave it alone until the real response lands.
          queryClient.setQueryData(['game', gameId], {
            ...previousGame,
            fen: chess.fen(),
            current_turn: chess.turn() === 'w' ? 'white' : 'black',
          } satisfies Game);
        } catch {
          // chess.js throws on an illegal move; nothing to optimistically
          // apply, just let the server respond.
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
    mutationFn: ({
      result,
      winnerId,
    }: {
      result: GameResult;
      winnerId?: string;
    }) => endGame(gameId, result, winnerId),
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
