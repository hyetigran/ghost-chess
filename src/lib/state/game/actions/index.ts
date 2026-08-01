import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Chess } from 'chess.js';
import { createGame, endGame, makeMove } from '~/api/server/game';
import { useAuth } from '~/context/auth-context';
import {
  GameResult,
  GameSettings,
  GameState,
  PlayerView,
} from '~/types/database';

export const useMakeMove = ({ gameId }: { gameId: string }) => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({
      from,
      to,
      promotion,
      gameState,
    }: {
      from: string;
      to: string;
      promotion?: string;
      gameState: GameState;
    }) => {
      if (!userId) throw new Error('User not authenticated');
      return makeMove(gameId, userId, gameState, from, to, promotion);
    },
    onMutate: async (newMove) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['game', gameId] });

      // Snapshot the previous value
      const previousGame = queryClient.getQueryData<PlayerView>([
        'game',
        gameId,
      ]);

      // Optimistically update to the new value. Built from the mover's own
      // redacted_fen (never the true games.fen — this client never reads
      // that while a game is active, per #12), which is exactly what the
      // mover is legitimately allowed to construct: their own move against
      // their own known pieces.
      if (previousGame) {
        try {
          const chess = new Chess(previousGame.redacted_fen);
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
            white_time_remaining: newMove.gameState.white_time_remaining,
            black_time_remaining: newMove.gameState.black_time_remaining,
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
