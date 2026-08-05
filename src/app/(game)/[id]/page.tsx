import { useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { View, Vibration } from 'react-native';
import { type Square } from 'chess.js';

import { ChessBoard } from '~/components/game/board/chess-board';
import { CapturedPieces } from '~/components/game/captured-pieces/captured-pieces-display';
import { MoveHistory } from '~/components/game/move-history/move-history';
import { PlayerCard } from '~/components/game/player-card/player-card';
import { GameControls } from '~/components/game/controls/game-controls';
import type { MoveEntry } from '~/lib/game/pair-moves';
import { ConfirmMoveDialog } from '~/components/game/move-confirmation/confirm-move-dialog';
import { GameOverModal } from '~/components/game/game-over/game-over-modal';
import { Button, Card, CardContent, Dialog, Text } from '~/components/ui';
import { formatTime } from '~/lib/utils/time';
import { useMakeMove, useEndGame } from '~/lib/state/game/actions';
import { gameQueries } from '~/lib/state/game/queries';
import { useQuery } from '@tanstack/react-query';
import { useGameTimer } from '~/lib/hooks/use-game-timer';
import { useGameSubscription } from '~/lib/hooks/use-game-subscription';
import { useCaptureFlash } from '~/lib/hooks/use-capture-flash';
import { useMoveConfirmation } from '~/lib/hooks/use-move-confirmation';
import { useAuth } from '~/context/auth-context';
import { useSettings } from '~/context/settings-context';

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
  const makeMove = useMakeMove({ gameId });
  const endGame = useEndGame({ gameId });
  const timer = useGameTimer(gameId);
  useGameSubscription(gameId);
  const { flashSquare, reportOwnMove } = useCaptureFlash(
    game,
    game?.white_player_id === userId ? 'white' : 'black',
  );
  const { moveConfirmationEnabled, vibrationEnabled } = useSettings();
  const { pendingMove, attemptMove, confirm, cancel } = useMoveConfirmation(
    moveConfirmationEnabled,
    (move) => {
      if (!userId) return;
      reportOwnMove(move.to as Square);
      makeMove.mutate(move);
    },
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

  return (
    <View className='flex-1 bg-background'>
      <View className='flex-1 p-4'>
        <View className='lg:flex-row lg:justify-center lg:items-start lg:gap-4'>
          <View className='w-full lg:w-[560px] lg:shrink-0'>
            {/* Player info and timer for black */}
            <View className='flex-row items-center justify-between mb-4'>
              <PlayerCard
                username={game.black_username}
                eloRating={game.black_elo_rating}
                isYou={game.black_player_id === userId}
              />
              <Text className='font-mono text-lg'>
                {timer?.activeColor === 'black'
                  ? formatTime(timer.secondsRemaining)
                  : '—'}
              </Text>
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
              onMove={(from, to) => {
                if (!userId) return;

                setViewingPly(null);
                // ChessBoard doesn't have a promotion-piece picker yet (a
                // separate UI feature) — default to auto-queen, the standard
                // convention when no picker is available, rather than let
                // every promotion attempt fail as an unexplained illegal move.
                // Routed through attemptMove rather than makeMove directly so
                // the optional confirm-before-send step (#22) can intercept it;
                // reportOwnMove/makeMove only run once the move is actually
                // submitted (see the useMoveConfirmation callback above).
                attemptMove({ from, to, promotion: 'q' });
              }}
              orientation={isWhitePlayer ? 'white' : 'black'}
              flashSquare={flashSquare}
              interactive={game.status === 'active' && viewingPly === null}
              inactiveLabel={
                viewingPly !== null ? 'Reviewing a past move' : 'Final position'
              }
            />

            {/* Captured pieces */}
            <CapturedPieces
              capturedByWhite={game.captured_by_white}
              capturedByBlack={game.captured_by_black}
            />

            {/* Player info and timer for white */}
            <View className='flex-row items-center justify-between mt-4'>
              <PlayerCard
                username={game.white_username}
                eloRating={game.white_elo_rating}
                isYou={game.white_player_id === userId}
              />
              <Text className='font-mono text-lg'>
                {timer?.activeColor === 'white'
                  ? formatTime(timer.secondsRemaining)
                  : '—'}
              </Text>
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
            <Card className='w-full max-w-[560px] self-center mt-4 lg:mt-0 lg:w-72 lg:max-w-none lg:self-start rounded-2xl'>
              <CardContent className='p-4'>
                <Text className='text-sm text-center text-muted-foreground'>
                  Move history is revealed once the game ends.
                </Text>
              </CardContent>
            </Card>
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
