import { useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { View, Vibration } from 'react-native';
import { Chess, type Square } from 'chess.js';

import { ChessBoard } from '~/components/game/board/chess-board';
import { MoveHistory } from '~/components/game/move-history/move-history';
import { PlayerCard } from '~/components/game/player-card/player-card';
import { GameControls } from '~/components/game/controls/game-controls';
import type { MoveEntry } from '~/lib/game/pair-moves';
import { ConfirmMoveDialog } from '~/components/game/move-confirmation/confirm-move-dialog';
import { GameOverModal } from '~/components/game/game-over/game-over-modal';
import { Button, Dialog, Text } from '~/components/ui';
import { formatTime } from '~/lib/utils/time';
import { deriveLastMoveSquares } from '~/lib/game/last-move-squares';
import { useMakeMove, useEndGame } from '~/lib/state/game/actions';
import { gameQueries } from '~/lib/state/game/queries';
import { useQuery } from '@tanstack/react-query';
import { useGameTimer } from '~/lib/hooks/use-game-timer';
import { useGameSubscription } from '~/lib/hooks/use-game-subscription';
import { useCaptureFlash } from '~/lib/hooks/use-capture-flash';
import { useGameSounds } from '~/lib/hooks/use-game-sounds';
import { useLastMoveTracking } from '~/lib/hooks/use-last-move-tracking';
import { useMoveConfirmation } from '~/lib/hooks/use-move-confirmation';
import { useAuth } from '~/context/auth-context';
import { useSettings } from '~/context/settings-context';

// Only ever used as the "previous position" for the very first ply's
// last-move diff (deriveLastMoveSquares) — both during live play and
// during post-game history review, ply 0 has no earlier move-list entry
// to diff against, so this stands in for it. A plain module-level
// constant rather than `new Chess().fen()` inline at every call site.
const STANDARD_START_FEN = new Chess().fen();

export default function GameScreen() {
  const { id: gameId } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const {
    data: game,
    isLoading,
    error,
  } = useQuery(gameQueries.gameById(gameId));
  const { data: movesData } = useQuery(gameQueries.gameMovesByGameId(gameId));
  // Incremented on every rejected move (onRejected below), regardless of
  // rejection reason — the sole trigger useGameSounds needs for the
  // illegal-move SFX (#80), see useMakeMove's onRejected doc for why the
  // reason itself is never passed through.
  const [rejectionPulse, setRejectionPulse] = React.useState(0);
  const makeMove = useMakeMove({
    gameId,
    onRejected: () => setRejectionPulse((current) => current + 1),
  });
  const endGame = useEndGame({ gameId });
  const timer = useGameTimer(gameId);
  useGameSubscription(gameId);
  const { flashSquare, reportOwnMove } = useCaptureFlash(
    game,
    game?.white_player_id === userId ? 'white' : 'black',
  );
  const { moveConfirmationEnabled, vibrationEnabled } = useSettings();
  useGameSounds(
    game?.status === 'active' ? game.redacted_fen : null,
    flashSquare,
    rejectionPulse,
    game?.result ?? null,
  );
  const { pendingMove, attemptMove, confirm, cancel } = useMoveConfirmation(
    moveConfirmationEnabled,
    (move) => {
      if (!userId) return;
      reportOwnMove(move.to as Square);
      makeMove.mutate(move);
    },
  );

  // Feeds ChessBoard's `lastMove` (#79 tasks 3a/3c) for the one path this
  // screen can't get it any other way: while a game is still active,
  // `moves.fen` is RLS-gated to post-completion (moves.gameMovesByGameId's
  // own comment), so there's no per-ply history to diff against directly
  // — only the live, in-place-updating `game.redacted_fen` this hook
  // watches. Passed null while inactive so a fresh 'active' fen arriving
  // right as the game ends can't get diffed against a stale live value
  // sitting in the hook's ref; the historical path below takes over
  // instead, computed straight off `moveEntries`.
  const liveLastMove = useLastMoveTracking(
    game?.status === 'active' ? game.redacted_fen : null,
  );

  const [showGameOver, setShowGameOver] = React.useState(false);
  const [viewingPly, setViewingPly] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (game?.status === 'completed') {
      setShowGameOver(true);
    }
  }, [game?.status]);

  React.useEffect(() => {
    if (flashSquare && vibrationEnabled) Vibration.vibrate();
  }, [flashSquare, vibrationEnabled]);

  if (isLoading) {
    return (
      <View className='items-center justify-center flex-1'>
        <Text>Loading game...</Text>
      </View>
    );
  }

  if (error || !game) {
    return (
      <View className='items-center justify-center flex-1'>
        <Text className='text-red-500'>
          {error?.message || 'Game not found'}
        </Text>
        <Button
          variant='outline'
          onPress={() => {
            // Navigate back to home
          }}
        >
          Go Back
        </Button>
      </View>
    );
  }

  const isWhitePlayer = game.white_player_id === userId;
  const isBlackPlayer = game.black_player_id === userId;
  const isYourTurn =
    (isWhitePlayer && game.current_turn === 'white') ||
    (isBlackPlayer && game.current_turn === 'black');

  const moveEntries: MoveEntry[] = (movesData ?? []).map((move) => ({
    san: move.move_text,
    color: move.player_id === game.white_player_id ? 'white' : 'black',
    fen: move.fen,
  }));

  // Once the game is no longer active, `moves.fen` is readable (same RLS
  // window as `redacted_fen` no longer being redacted, ADR-0003) and true
  // — safe to diff directly with no fog argument needed, unlike
  // `liveLastMove` above. Only computed for the ply actually on screen
  // (`viewingPly`, or the final position when not browsing history) —
  // deriving it for every ply and picking one afterward would be wasted
  // work for the common case of never opening MoveHistory at all.
  const historicalPlyIndex =
    game.status !== 'active' && moveEntries.length > 0
      ? (viewingPly ?? moveEntries.length - 1)
      : null;
  const historicalLastMove =
    historicalPlyIndex !== null
      ? deriveLastMoveSquares(
          historicalPlyIndex === 0
            ? STANDARD_START_FEN
            : moveEntries[historicalPlyIndex - 1].fen,
          moveEntries[historicalPlyIndex].fen,
        )
      : null;
  const lastMove = game.status === 'active' ? liveLastMove : historicalLastMove;

  // The small king-icon result marker (#79 task 3f) — only set once the
  // game has genuinely ended with 'completed'/'abandoned' (not 'waiting',
  // which has no result yet, and not merely `interactive` being false for
  // some other reason, e.g. history review — ChessBoard's `resultWinner`
  // doc covers why that distinction matters). Scoped to the live final
  // position only (`viewingPly === null`), not every historical ply: an
  // earlier ply can show the eventual loser's king still on the board
  // before it was actually captured, which the icon would misrepresent
  // as already having lost at that point in the game.
  const resultWinner: 'white' | 'black' | null | undefined =
    (game.status === 'completed' || game.status === 'abandoned') &&
    viewingPly === null
      ? game.winner_id === game.white_player_id
        ? 'white'
        : game.winner_id === game.black_player_id
          ? 'black'
          : null
      : undefined;

  // Mockup game screen: the viewer sits at the bottom, opponent on top —
  // matching the board orientation. Spectators get the white-at-bottom
  // default.
  const bottomColor: 'white' | 'black' = isBlackPlayer ? 'black' : 'white';
  const topColor: 'white' | 'black' =
    bottomColor === 'white' ? 'black' : 'white';

  const playerRowProps = (color: 'white' | 'black') => {
    const isViewer = color === 'white' ? isWhitePlayer : isBlackPlayer;
    return {
      username: color === 'white' ? game.white_username : game.black_username,
      eloRating:
        color === 'white' ? game.white_elo_rating : game.black_elo_rating,
      isYou: isViewer,
      capturedTypes:
        color === 'white' ? game.captured_by_white : game.captured_by_black,
      // captured_by_white holds black's piece types, and vice versa.
      capturedColor: (color === 'white' ? 'b' : 'w') as 'w' | 'b',
      clock:
        timer?.activeColor === color
          ? formatTime(timer.secondsRemaining)
          : null,
      clockActive: isViewer && timer?.activeColor === color,
    };
  };

  return (
    <View className='flex-1 bg-background'>
      <View className='flex-1 p-4'>
        <View className='lg:flex-row lg:justify-center lg:items-start lg:gap-4'>
          <View className='w-full lg:w-[560px] lg:shrink-0'>
            {/* Opponent row (top), per the mockup game screen */}
            <View className='mb-3'>
              <PlayerCard {...playerRowProps(topColor)} />
            </View>

            {/* Chess board */}
            <ChessBoard
              // moves.fen is only ever fetchable once the game is
              // completed/abandoned (RLS, see gameQueries.gameMovesByGameId),
              // exactly when sync_player_views also stops redacting
              // game.redacted_fen itself — so a historical position here
              // needs no separate client-side redaction call.
              redactedFen={
                viewingPly !== null
                  ? moveEntries[viewingPly].fen
                  : game.redacted_fen
              }
              onMove={(from, to, promotion) => {
                if (!userId) return;

                setViewingPly(null);
                // `promotion` is set by ChessBoard's picker only for actual
                // pawn promotions; the 'q' fallback just satisfies
                // PendingMove's required field and is ignored by the server
                // for non-promotion moves (findPseudoLegalMove).
                // Routed through attemptMove rather than makeMove directly so
                // the optional confirm-before-send step (#22) can intercept it;
                // reportOwnMove/makeMove only run once the move is actually
                // submitted (see the useMoveConfirmation callback above).
                attemptMove({ from, to, promotion: promotion ?? 'q' });
              }}
              orientation={isWhitePlayer ? 'white' : 'black'}
              flashSquare={flashSquare}
              interactive={game.status === 'active' && viewingPly === null}
              inactiveLabel={
                viewingPly !== null
                  ? 'Reviewing a past move'
                  : game.status === 'waiting'
                    ? 'Waiting for an opponent'
                    : 'Final position'
              }
              lastMove={lastMove}
              resultWinner={resultWinner}
            />

            {/* Viewer row (bottom) — captured pieces render inside each
                player row now, per the mockup's "♟♟♝" line. */}
            <View className='mt-3'>
              <PlayerCard {...playerRowProps(bottomColor)} />
            </View>

            {/* Game controls */}
            <GameControls
              onResign={() => {
                if (!userId) return;
                endGame.mutate();
              }}
              onDraw={() => {
                // Implement draw offer
              }}
              isYourTurn={isYourTurn}
            />
          </View>

          {/* Move history — moves.fen holds the true position, so RLS
              (supabase/schemas/07_rls.sql) only allows reading it once the
              game is completed/abandoned, matching the same window
              game.redacted_fen itself stops being redacted. Showing an
              empty-looking card during active play would look like a bug
              rather than the deliberate occlusion boundary it is. */}
          {game.status === 'active' ? (
            <View className='w-full max-w-[560px] self-center mt-2 lg:mt-0 lg:w-72 lg:max-w-none lg:self-start px-3 py-2.5 bg-card rounded-strip shadow-card'>
              <Text className='font-mono text-[13px] text-center text-muted-foreground'>
                Move history is revealed once the game ends
              </Text>
            </View>
          ) : (
            <MoveHistory
              moves={moveEntries}
              viewingPly={viewingPly}
              onSelectPly={setViewingPly}
            />
          )}
        </View>
      </View>

      {/* Move confirmation prompt (#22) */}
      <Dialog open={!!pendingMove} onOpenChange={(open) => !open && cancel()}>
        <ConfirmMoveDialog
          pendingMove={pendingMove}
          onConfirm={confirm}
          onCancel={cancel}
        />
      </Dialog>

      {/* Game over modal */}
      <Dialog open={showGameOver} onOpenChange={setShowGameOver}>
        <GameOverModal
          gameId={gameId}
          result={game.result}
          winnerId={game.winner_id}
          viewerId={userId}
          onReviewBoard={() => setShowGameOver(false)}
          onRematch={() => {
            // Implement rematch
          }}
          onNewGame={() => {
            // Navigate to new game
          }}
        />
      </Dialog>
    </View>
  );
}
