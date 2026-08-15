import * as React from 'react';
import { Image, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { type Piece, type Square } from 'chess.js';
import { Text } from '~/components/ui/text';
import {
  fileLabels,
  rankLabels,
  squareAt,
  type Orientation,
} from '~/lib/game/board-geometry';
import { dragTargetSquare } from '~/lib/game/drag-target-square';
import { legalTargetSquares } from '~/lib/game/legal-target-squares';
import { pieceImage } from '~/lib/game/piece-image';
import { isPromotionMove, type PromotionPiece } from '~/lib/game/promotion';
import { chessFromRedactedFen } from '~/lib/game/redacted-chess';
import { useSquareSelection } from '~/lib/hooks/use-square-selection';
import { CloudFogOverlay } from './cloud-fog-overlay';
import { PromotionPicker } from './promotion-picker';

const LABEL_GUTTER = 16;
// A drag must move at least this many pixels before it's treated as a
// drag rather than a tap — lets Gesture.Race let the tap gesture win a
// quick press-and-release, matching how every drag-and-drop chess UI
// disambiguates the two.
const DRAG_ACTIVATION_DISTANCE = 8;
// The origin square's piece stays visible but dimmed while its "ghost"
// follows the pointer, rather than disappearing outright — standard
// drag-and-drop convention, and it keeps the square's own highlight
// state legible underneath.
const DRAGGED_PIECE_OPACITY = 0.35;
// One full lap of the shared cloud-drift clock (cloud-fog-overlay.tsx) —
// long and linear so the haze reads as "slowly shifting weather," not as
// an obviously-looping animation.
const CLOUD_DRIFT_DURATION_MS = 26000;

type Props = {
  /**
   * The FEN this board renders — always the caller's own redacted view
   * (player_views.redacted_fen), never the true game state (ADR-0001).
   * This component has no way to enforce that itself — it renders
   * whatever FEN it's handed — the actual guarantee lives at the caller
   * (src/api/server/game.ts's getGame reads player_views only, #12).
   * Named explicitly rather than a generic `fen` so a future caller can't
   * casually wire in the true games.fen without the prop name itself
   * being a hint that something's wrong.
   */
  redactedFen: string;
  /**
   * `promotion` is set only when the move is a pawn reaching its last
   * rank, chosen via the in-board PromotionPicker; every other move
   * omits it. Callers that need a value for non-promotion moves too
   * (PendingMove's required `promotion`) default it to 'q', which the
   * move-matching layer ignores unless the move actually promotes
   * (pseudo-legal-moves.ts findPseudoLegalMove).
   */
  onMove: (from: string, to: string, promotion?: PromotionPiece) => void;
  orientation: Orientation;
  /** Briefly highlighted on a capture (src/lib/hooks/use-capture-flash.ts, #18). */
  flashSquare?: Square | null;
  /**
   * False once a game is no longer active (#19) — `redactedFen` stops
   * being redacted at that point (ADR-0003) and this same board becomes
   * the post-game final-position view, so taps must stop being treated
   * as move attempts rather than just relying on the server to reject
   * them.
   */
  interactive?: boolean;
  /** Label shown over the board while `interactive` is false. */
  inactiveLabel?: string;
};

// Origin square + its display coordinates + a snapshot of the piece
// itself, captured at drag-start rather than re-read from `chess` later
// — the board's own position can change mid-drag (an opponent's move
// arriving over realtime while you're still dragging), and the floating
// piece should keep showing what you picked up, not flicker.
type DraggedPiece = {
  square: Square;
  displayRank: number;
  displayFile: number;
  piece: Piece;
};

export function ChessBoard({
  redactedFen,
  onMove,
  orientation,
  flashSquare,
  interactive = true,
  inactiveLabel = 'Final position',
}: Props): React.JSX.Element {
  const chess = React.useMemo(
    () => chessFromRedactedFen(redactedFen),
    [redactedFen],
  );
  // A pawn move onto its last rank pauses here instead of firing onMove:
  // the picker overlay collects the piece choice, then the move goes out
  // with it. Any position change while the picker is open (an opponent
  // move arriving over realtime, history navigation) discards the
  // pending promotion — the move was decided against a board that no
  // longer exists.
  const [pendingPromotion, setPendingPromotion] = React.useState<{
    from: string;
    to: string;
  } | null>(null);
  React.useEffect(() => {
    setPendingPromotion(null);
  }, [redactedFen]);
  const handleMoveIntent = (from: string, to: string): void => {
    if (isPromotionMove(chess, from, to)) {
      setPendingPromotion({ from, to });
      return;
    }
    onMove(from, to);
  };
  const { selectedSquare, legalTargets, handleSquarePress } =
    useSquareSelection(chess, orientation, handleMoveIntent);
  const ownPieceColor = orientation === 'white' ? 'w' : 'b';
  // Fog/haze rule: a square is NOT hazy iff one of the viewer's own
  // pieces could currently move there (legal-target-squares.ts) — every
  // other square gets the haze, whether it's genuinely empty or hiding an
  // enemy piece; the board can't tell those apart any more than the
  // player can. Own pieces are always "known," so they're never hazy
  // regardless of this set. Deliberately not the same set as ADR-0008's
  // attack-based vision (computeVisibleSquares, redact-fen.ts) — that
  // still governs what's actually revealed server-side; this only
  // governs the board's visual haze, and includes e.g. a pawn's forward
  // push square, which is a legal destination but not a vision square.
  const reachableSquares = React.useMemo(
    () => legalTargetSquares(chess, ownPieceColor),
    [chess, ownPieceColor],
  );
  // Every caller sets `interactive` to false exactly when `redactedFen`
  // has stopped being redacted (ADR-0003's reveal-on-completion, for the
  // online screen; local/AI games never render this component at all
  // once they're over, only mid-game history review, which is still
  // genuinely occluded) — showing fog over an already-fully-revealed
  // position would misrepresent it as still uncertain, so fog is skipped
  // entirely once `interactive` is false rather than computed and hidden.
  const fogEnabled = interactive;
  // Single UI-thread clock driving every hazy square's cloud drift
  // (cloud-fog-overlay.tsx) — one repeating animation shared across
  // however many squares are currently hazy, rather than each square
  // running its own. Only started when fog can actually be showing.
  const cloudDrift = useSharedValue(0);
  React.useEffect(() => {
    if (!fogEnabled) return;
    cloudDrift.value = withRepeat(
      withTiming(1, {
        duration: CLOUD_DRIFT_DURATION_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    // The `-1` repeat above never resolves on its own — without this,
    // an `interactive` board that later flips to non-interactive (a game
    // ending, ADR-0003's reveal-on-completion) would leave the clock
    // spinning on the UI thread for the rest of this ChessBoard's
    // lifetime with no overlay left consuming it.
    return () => cancelAnimation(cloudDrift);
  }, [fogEnabled, cloudDrift]);

  // Pixel size of one square, measured once the grid actually lays out —
  // dragTargetSquare needs real pixels, not the percentage widths the
  // squares themselves are styled with.
  const [gridSize, setGridSize] = React.useState(0);
  const squareSize = gridSize / 8;
  const handleGridLayout = (event: LayoutChangeEvent): void => {
    setGridSize(event.nativeEvent.layout.width);
  };

  const [draggedFrom, setDraggedFrom] = React.useState<DraggedPiece | null>(
    null,
  );
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const floatingPieceStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }],
  }));

  // A drag is just a compressed tap-tap: pointer-down "presses" the
  // origin square (selects it, same as a first tap) and pointer-up
  // "presses" the square under the release point (moves if it's a legal
  // target, deselects otherwise, same as a second tap) — reusing
  // handleSquarePress for both means every existing rule (own-piece-only
  // selection, move confirmation at the caller level, king capture, ...)
  // applies identically to drag and tap with no duplicated logic.
  const handleDragStart = (
    square: Square,
    displayRank: number,
    displayFile: number,
    piece: Piece,
  ): void => {
    setDraggedFrom({ square, displayRank, displayFile, piece });
    handleSquarePress(square);
  };

  const handleDragEnd = (
    fromDisplayRank: number,
    fromDisplayFile: number,
    translationX: number,
    translationY: number,
  ): void => {
    const targetSquare = dragTargetSquare(
      fromDisplayRank,
      fromDisplayFile,
      translationX,
      translationY,
      squareSize,
      orientation,
    );
    setDraggedFrom(null);
    handleSquarePress(targetSquare);
  };

  return (
    <View
      className={`w-full max-w-[560px] self-center ${interactive ? '' : 'opacity-70'}`}
    >
      {!interactive && (
        <View className='absolute inset-x-0 z-10 items-center -top-7'>
          <Text className='font-mono-semibold text-[11px] uppercase tracking-[0.88px] text-faint'>
            {inactiveLabel}
          </Text>
        </View>
      )}
      <View className='flex-row'>
        <View style={{ width: LABEL_GUTTER }}>
          {rankLabels(orientation).map((rank) => (
            <View key={rank} className='items-center justify-center flex-1'>
              <Text className='font-mono text-[10px] text-faint'>{rank}</Text>
            </View>
          ))}
        </View>
        <View className='flex-1 aspect-square' onLayout={handleGridLayout}>
          <View className='flex-row flex-wrap flex-1'>
            {Array.from({ length: 8 }).map((_, displayRank) =>
              Array.from({ length: 8 }).map((_, displayFile) => {
                const square = squareAt(displayRank, displayFile, orientation);
                const isLight = (displayRank + displayFile) % 2 === 0;
                const piece = chess.get(square);
                const isSelected = selectedSquare === square;
                const isLegalTarget = legalTargets.has(square);
                const isFlashing = flashSquare === square;
                const isHazy =
                  fogEnabled &&
                  piece?.color !== ownPieceColor &&
                  !reachableSquares.has(square);
                const isBeingDragged = draggedFrom?.square === square;

                const tapGesture = Gesture.Tap()
                  .enabled(interactive)
                  .onEnd((_event, success) => {
                    if (success) {
                      runOnJS(handleSquarePress)(square);
                    }
                  });

                const panGesture = Gesture.Pan()
                  .enabled(
                    interactive &&
                      squareSize > 0 &&
                      piece?.color === ownPieceColor,
                  )
                  .minDistance(DRAG_ACTIVATION_DISTANCE)
                  .onBegin(() => {
                    dragX.value = 0;
                    dragY.value = 0;
                    if (piece) {
                      runOnJS(handleDragStart)(
                        square,
                        displayRank,
                        displayFile,
                        piece,
                      );
                    }
                  })
                  .onUpdate((event) => {
                    dragX.value = event.translationX;
                    dragY.value = event.translationY;
                  })
                  .onEnd((event) => {
                    dragX.value = withSpring(0);
                    dragY.value = withSpring(0);
                    runOnJS(handleDragEnd)(
                      displayRank,
                      displayFile,
                      event.translationX,
                      event.translationY,
                    );
                  });

                const squareGesture = Gesture.Race(tapGesture, panGesture);

                return (
                  <GestureDetector key={square} gesture={squareGesture}>
                    <View
                      className={`w-[12.5%] h-[12.5%] items-center justify-center ${
                        isLight ? 'bg-squareLight' : 'bg-squareDark'
                      }`}
                    >
                      {/* Mockup highlight treatments layer over the
                          checker color instead of replacing it: selected
                          = 45% highlight wash + 3px inset accent ring;
                          legal target = centered 30% dot; capture flash
                          = inset danger ring. */}
                      {/* Explicit rgba values rather than token/opacity
                          modifiers — the theme colors are hsl(var())
                          strings without <alpha-value>, so /45-style
                          modifiers would render fully opaque. */}
                      {isSelected && (
                        <View
                          className='absolute inset-0 bg-[rgba(240,214,86,0.45)] dark:bg-[rgba(240,214,86,0.4)] border-[3px] border-primary'
                          pointerEvents='none'
                        />
                      )}
                      {isLegalTarget && !isSelected && (
                        <View
                          className='absolute inset-0 items-center justify-center'
                          pointerEvents='none'
                        >
                          <View className='w-[30%] h-[30%] rounded-full bg-[rgba(27,26,23,0.28)] dark:bg-[rgba(0,0,0,0.35)]' />
                        </View>
                      )}
                      {piece && (
                        <Image
                          source={pieceImage(piece)}
                          style={{
                            width: '80%',
                            height: '80%',
                            opacity: isBeingDragged ? DRAGGED_PIECE_OPACITY : 1,
                          }}
                          resizeMode='contain'
                        />
                      )}
                      {isFlashing && (
                        <View
                          className='absolute inset-0 border-4 border-[rgba(198,63,49,0.75)] dark:border-[rgba(226,112,95,0.85)]'
                          pointerEvents='none'
                        />
                      )}
                      {/* Layered blobs rather than a flat color swap, so
                          the light/dark checker pattern (and any highlight
                          underneath) still shows faintly through — reads as
                          "clouds obscuring this square," not "this is a
                          third square color" (#77). pointerEvents="none"
                          (both here and inside the overlay itself) so it
                          never steals the tap from the gesture detector
                          the square sits on. */}
                      {isHazy && (
                        <CloudFogOverlay
                          square={square}
                          driftProgress={cloudDrift}
                          squareSize={squareSize}
                        />
                      )}
                    </View>
                  </GestureDetector>
                );
              }),
            )}
          </View>
          {draggedFrom && squareSize > 0 && (
            <Animated.View
              pointerEvents='none'
              style={[
                {
                  position: 'absolute',
                  left: draggedFrom.displayFile * squareSize,
                  top: draggedFrom.displayRank * squareSize,
                  width: squareSize,
                  height: squareSize,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                floatingPieceStyle,
              ]}
            >
              <Image
                source={pieceImage(draggedFrom.piece)}
                style={{ width: '80%', height: '80%' }}
                resizeMode='contain'
              />
            </Animated.View>
          )}
          {pendingPromotion && (
            <PromotionPicker
              color={ownPieceColor}
              onPick={(piece) => {
                setPendingPromotion(null);
                onMove(pendingPromotion.from, pendingPromotion.to, piece);
              }}
              onCancel={() => setPendingPromotion(null)}
            />
          )}
        </View>
      </View>
      <View className='flex-row'>
        <View style={{ width: LABEL_GUTTER }} />
        <View className='flex-row flex-1'>
          {fileLabels(orientation).map((file) => (
            <View key={file} className='items-center justify-center flex-1'>
              <Text className='font-mono text-[10px] text-faint'>
                {file.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
