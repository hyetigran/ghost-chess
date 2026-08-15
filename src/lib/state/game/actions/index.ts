import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showMessage } from 'react-native-flash-message';
import {
  createGame,
  endGame,
  joinGame,
  submitMove,
  type SubmitMoveError,
} from '~/api/server/game';
import { useAuth } from '~/context/auth-context';
import { chessFromRedactedFen } from '~/lib/game/redacted-chess';
import { GameSettings, PlayerView } from '~/types/database';

// One message per SubmitMoveErrorCode — "illegal_move" stays deliberately
// generic (ADR-0007: it's the uniform code for several different
// board-related rejection reasons, including a move that only looked
// legal because it targeted a hidden opponent piece) rather than
// guessing at which one applies. Told to the mover themselves, about
// their own just-attempted move — unlike the server's own response
// timing/shape (what ADR-0007 actually constrains), this discloses
// nothing beyond what the player already knows they just tried.
function describeMoveError(error: SubmitMoveError): string {
  switch (error.code) {
    case 'rate_limited':
      return 'Too many move attempts — wait a moment and try again.';
    case 'unauthorized':
      return 'You need to be signed in to move.';
    case 'illegal_move':
    case 'internal_error':
    default:
      return "That move wasn't accepted — the board may have changed. Tap the board again to try.";
  }
}

export const useMakeMove = ({
  gameId,
  onRejected,
}: {
  gameId: string;
  // Called from onError below, for every rejection reason alike (rate
  // limit, auth, illegal move, internal error) — this is the one uniform
  // client-side reject path a submitted move can hit, so it's also the
  // one place the illegal-move SFX (#80) hooks in. It deliberately isn't
  // passed the error/reason: per ADR-0007, the whole point of this path
  // being uniform is that nothing downstream of it — including a sound
  // effect — gets to branch on *why* the move was rejected.
  onRejected?: () => void;
}) => {
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
          // Before chessFromRedactedFen existed, this threw for any real
          // active game (redacted FENs omit the opponent's king) — the
          // try/catch was silently swallowing it every time,
          // indistinguishable from the "illegal move" catch case below,
          // so the optimistic update never actually applied.
          const chess = chessFromRedactedFen(previousGame.redacted_fen);
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
      console.warn('move rejected:', err instanceof Error ? err.message : err);
      // A rejected move used to just silently snap back with zero
      // feedback — most confusingly for a move that looked completely
      // legal client-side (e.g. a pawn push into a hidden, actually-
      // occupied square, src/lib/game/legal-move-targets.ts). Whatever
      // the actual rejection reason, the player deserves to know their
      // tap didn't land rather than wonder if the app is broken.
      showMessage({
        message: describeMoveError(err as SubmitMoveError),
        type: 'warning',
      });
      onRejected?.();
    },
    onSettled: () => {
      // Refetch the game to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      // Also the move list (MoveHistory) - a separate query key from the
      // game object itself, so it doesn't get refreshed by the line above.
      queryClient.invalidateQueries({ queryKey: ['game', 'moves', gameId] });
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

export const useJoinGame = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (gameId: string) => {
      if (!userId) throw new Error('User not authenticated');
      return joinGame(gameId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game'] });
    },
  });
};
