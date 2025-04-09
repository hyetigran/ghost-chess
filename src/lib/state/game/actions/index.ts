import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Chess } from 'chess.js';
import { createGame, endGame, makeMove } from '~/api/server/game';
import { useAuth } from '~/context/auth-context';
import { Game, GameResult, GameSettings, GameState } from '~/types/database';

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
      const previousGame = queryClient.getQueryData<Game>(['game', gameId]);

      // Optimistically update to the new value
      if (previousGame) {
        const chess = new Chess(previousGame.fen);
        chess.move({
          from: newMove.from,
          to: newMove.to,
          promotion: newMove.promotion,
        });

        const updatedGame: Game = {
          ...previousGame,
          fen: chess.fen(),
          pgn: chess.pgn(),
          current_turn:
            previousGame.current_turn === 'white' ? 'black' : 'white',
          white_time_remaining: newMove.gameState.white_time_remaining,
          black_time_remaining: newMove.gameState.black_time_remaining,
        };

        queryClient.setQueryData(['game', gameId], updatedGame);
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
