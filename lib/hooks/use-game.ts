import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gameApi } from '~/api/game/client';
import type { GameState, Move } from '~/types/game';
import { Chess } from 'chess.js';

export function useGame(gameId: string) {
  const queryClient = useQueryClient();

  const { data: game, ...rest } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => gameApi.getGame(gameId),
    enabled: !!gameId,
  });

  const makeMove = useMutation({
    mutationFn: (move: Move) => gameApi.makeMove(gameId, move),
    onMutate: async (newMove) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['game', gameId] });

      // Snapshot the previous value
      const previousGame = queryClient.getQueryData<GameState>([
        'game',
        gameId,
      ]);

      // Optimistically update to the new value
      if (previousGame) {
        const chess = new Chess(previousGame.fen);
        chess.move({
          from: newMove.from,
          to: newMove.to,
          promotion: newMove.piece[1].toLowerCase() as 'q' | 'r' | 'b' | 'n',
        });

        const updatedGame: GameState = {
          ...previousGame,
          fen: chess.fen(),
          pgn: chess.pgn(),
          currentTurn: previousGame.currentTurn === 'white' ? 'black' : 'white',
          lastMove: newMove.san,
          capturedPieces: {
            ...previousGame.capturedPieces,
            [previousGame.currentTurn === 'white' ? 'black' : 'white']: [
              ...previousGame.capturedPieces[
                previousGame.currentTurn === 'white' ? 'black' : 'white'
              ],
              newMove.captured!,
            ],
          },
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

  const abandonGame = useMutation({
    mutationFn: (abandoningPlayerColor: 'white' | 'black') =>
      gameApi.abandonGame(gameId, abandoningPlayerColor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

  return {
    game,
    makeMove,
    abandonGame,
    ...rest,
  };
}
