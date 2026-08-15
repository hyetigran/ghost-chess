import * as React from 'react';
import { Image, View } from 'react-native';
import {
  GestureDetector,
  type ComposedGesture,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { type Piece, type Square } from 'chess.js';
import { pieceImage } from '~/lib/game/piece-image';
import { Crown } from '~/lib/icons/Crown';
import { Skull } from '~/lib/icons/Skull';
import { CloudFogOverlay } from './cloud-fog-overlay';

// A ring expanding out from center and fading over ~380ms — deliberately
// quick and subtle rather than a showy effect, since this fires on every
// single selection (#79 task 3b) and needs to read as "acknowledged your
// tap," not compete with the piece image sitting on top of it.
const RIPPLE_DURATION_MS = 380;
// The last-move pulse (#79 task 3a) plays once when a square newly
// becomes part of the last move, then settles into the persistent tint
// that task 3c keeps showing for as long as this is still the last move
// — a bit slower than the ripple so the two read as distinct gestures
// (an outward burst on your own tap vs. a settling flash on a move
// landing), not the same animation reused twice.
const LAST_MOVE_PULSE_DURATION_MS = 520;
// The origin square's piece stays visible but dimmed while its "ghost"
// follows the pointer during a drag, rather than disappearing outright —
// standard drag-and-drop convention, and it keeps the square's own
// highlight state legible underneath.
const DRAGGED_PIECE_OPACITY = 0.35;

export type ResultIcon = 'winner' | 'loser' | null;

type Props = {
  square: Square;
  isLight: boolean;
  piece: Piece | undefined;
  isSelected: boolean;
  isLegalTarget: boolean;
  /** Distinguishes the small/large legal-target dot (#79 task 3d) — a
   * square already showing a piece in this (redacted) view is a capture
   * candidate, including a pawn's speculative diagonal, and gets the
   * larger dot; a square that currently reads empty gets the small one.
   * Never inferred from anything beyond what's already rendered — a
   * square hidden by fog always reads as empty here, same as a genuinely
   * empty one, so this can't leak which hazy squares are secretly
   * occupied. */
  isLegalTargetOccupied: boolean;
  isFlashing: boolean;
  isHazy: boolean;
  isBeingDragged: boolean;
  /**
   * Whether this square is the last move's origin/destination — already
   * pre-filtered for fog safety by the caller (ChessBoard's `lastMove`
   * prop doc has the full argument); this component just renders
   * whichever of the two booleans it's handed, with no fog reasoning of
   * its own.
   */
  isLastMoveFrom: boolean;
  isLastMoveTo: boolean;
  /** Changes whenever the position does — the last-move pulse effect
   * keys off this (not the two booleans above) so a square that stays
   * the last-move square across an unrelated re-render never replays,
   * but one that's freshly the last-move square on a genuinely new
   * position always does, even if some other square held that same
   * boolean state a moment ago. */
  lastMoveVersion: string;
  resultIcon: ResultIcon;
  /** Pixel size of one square — 0 before the board's first layout pass,
   * in which case the fog overlay and result icon simply don't render
   * yet (both need real pixels), same as the drag layer already handled
   * this in ChessBoard before the BoardSquare split. */
  squareSize: number;
  cloudDrift: import('react-native-reanimated').SharedValue<number>;
  gesture: ComposedGesture;
};

export function BoardSquare({
  square,
  isLight,
  piece,
  isSelected,
  isLegalTarget,
  isLegalTargetOccupied,
  isFlashing,
  isHazy,
  isBeingDragged,
  isLastMoveFrom,
  isLastMoveTo,
  lastMoveVersion,
  resultIcon,
  squareSize,
  cloudDrift,
  gesture,
}: Props): React.JSX.Element {
  const isLastMoveSquare = isLastMoveFrom || isLastMoveTo;

  const rippleProgress = useSharedValue(0);
  React.useEffect(() => {
    if (!isSelected) return;
    rippleProgress.value = 0;
    rippleProgress.value = withTiming(1, {
      duration: RIPPLE_DURATION_MS,
      easing: Easing.out(Easing.quad),
    });
    // isSelected flipping back to false mid-ripple just lets whatever
    // frame is in flight keep playing to completion rather than
    // reversing it — a cancelled ripple reading as "undone" would be a
    // stranger result than just letting a quick tap-away finish quietly.
  }, [isSelected, rippleProgress]);
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: (1 - rippleProgress.value) * 0.55,
    transform: [{ scale: 0.25 + rippleProgress.value * 1.6 }],
  }));

  const pulseProgress = useSharedValue(0);
  React.useEffect(() => {
    if (!isLastMoveSquare) return;
    pulseProgress.value = 0;
    pulseProgress.value = withTiming(1, {
      duration: LAST_MOVE_PULSE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMoveVersion]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulseProgress.value) * 0.5,
    transform: [{ scale: 1 + (1 - pulseProgress.value) * 0.35 }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        className={`w-[12.5%] h-[12.5%] items-center justify-center ${
          isLight ? 'bg-squareLight' : 'bg-squareDark'
        }`}
      >
        {/* Mockup highlight treatments layer over the checker color
            instead of replacing it: selected = 45% highlight wash + 3px
            inset accent ring; legal target = centered dot, small on an
            empty square and larger on a capture candidate (#79 task 3d);
            capture flash = inset danger ring; last move = a distinct
            (blue) wash on both its from and to squares (#79 task 3c),
            kept visually separate from the gold selection wash so
            selecting the piece that just moved doesn't read as "no last
            move shown." */}
        {/* Explicit rgba values rather than token/opacity modifiers — the
            theme colors are hsl(var())strings without <alpha-value>, so
            /45-style modifiers would render fully opaque. */}
        {isLastMoveSquare && (
          <View
            className='absolute inset-0 bg-[rgba(74,144,226,0.28)] dark:bg-[rgba(96,165,250,0.24)]'
            pointerEvents='none'
          />
        )}
        {isLastMoveSquare && (
          <Animated.View
            className='absolute inset-0 bg-[rgba(74,144,226,0.4)] dark:bg-[rgba(96,165,250,0.35)]'
            style={pulseStyle}
            pointerEvents='none'
          />
        )}
        {isSelected && (
          <View
            className='absolute inset-0 bg-[rgba(240,214,86,0.45)] dark:bg-[rgba(240,214,86,0.4)] border-[3px] border-primary'
            pointerEvents='none'
          />
        )}
        {isSelected && (
          <Animated.View
            pointerEvents='none'
            className='absolute inset-0 items-center justify-center'
          >
            <Animated.View
              style={rippleStyle}
              className='w-[70%] h-[70%] rounded-full bg-[rgba(240,214,86,0.55)] dark:bg-[rgba(240,214,86,0.5)]'
            />
          </Animated.View>
        )}
        {isLegalTarget && !isSelected && (
          <View
            className='absolute inset-0 items-center justify-center'
            pointerEvents='none'
          >
            <View
              className={`rounded-full bg-[rgba(27,26,23,0.28)] dark:bg-[rgba(0,0,0,0.35)] ${
                isLegalTargetOccupied ? 'w-[62%] h-[62%]' : 'w-[30%] h-[30%]'
              }`}
            />
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
        {/* Post-game result marker (#79 task 3f) — only ever passed once
            the board is already non-interactive and occlusion has lifted
            (ChessBoard's `resultWinner` prop doc), so there's no fog
            question here at all, just "which king is which." */}
        {resultIcon && (
          <View
            className='absolute items-center justify-center rounded-full bg-background/90 -top-1 -right-1 w-[34%] h-[34%]'
            pointerEvents='none'
          >
            {resultIcon === 'winner' ? (
              <Crown
                size={Math.max(10, squareSize * 0.5)}
                className='text-[#2f9e44] dark:text-[#4ade80]'
              />
            ) : (
              <Skull
                size={Math.max(10, squareSize * 0.5)}
                className='text-[#c6392f] dark:text-[#e2705f]'
              />
            )}
          </View>
        )}
        {/* Layered blobs rather than a flat color swap, so the light/dark
            checker pattern (and any highlight underneath) still shows
            faintly through — reads as "clouds obscuring this square,"
            not "this is a third square color" (#77). pointerEvents="none"
            (both here and inside the overlay itself) so it never steals
            the tap from the gesture detector the square sits on. */}
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
}
