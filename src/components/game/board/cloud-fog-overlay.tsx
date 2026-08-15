import * as React from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { type Square } from 'chess.js';
import { cloudBlobsForSquare, type CloudBlob } from '~/lib/game/cloud-fog';

// How far a blob drifts off its resting position at the peak of its
// cycle, as a percentage of the square's side — small on purpose. This
// overlay's job is to read as "obscured," not to draw the eye; a drift
// big enough to notice as *motion* would compete with the pieces and
// highlights it sits over. Expressed as a percentage (converted to
// pixels below) rather than a flat pixel constant so it scales with the
// board instead of looking proportionally larger on a small screen.
const DRIFT_AMPLITUDE_PCT = 3;

type Props = {
  square: Square;
  /**
   * 0→1 sawtooth shared across every hazy square on the board (driven
   * once in chess-board.tsx). Each blob turns it into its own drift via
   * `sin(progress · 2π + driftPhase)`, so one UI-thread animation clock
   * — not one per square, not one per blob — is enough to make the whole
   * board's haze drift, regardless of how many squares are currently
   * hazy.
   */
  driftProgress: SharedValue<number>;
  /** Current pixel size of one square — drift is expressed in pixels
   * (Reanimated transforms don't accept percentage strings on native),
   * while every other blob dimension below is a plain percentage string
   * so it scales with the square's own layout. */
  squareSize: number;
};

/**
 * Cloud-like haze for a single hazy square: a few overlapping, irregular,
 * semi-transparent blobs instead of one flat tint — replaces the old
 * `bg-fog` fill (issue #77). Membership (which squares get this at all)
 * is untouched here; that's `isHazy` in chess-board.tsx / #78's concern,
 * not this component's.
 */
export function CloudFogOverlay({
  square,
  driftProgress,
  squareSize,
}: Props): React.JSX.Element {
  const blobs = React.useMemo(() => cloudBlobsForSquare(square), [square]);
  return (
    <View className='absolute inset-0 overflow-hidden' pointerEvents='none'>
      {blobs.map((blob, index) => (
        <CloudBlobLayer
          // Position alone isn't a stable key — two blobs on the same
          // square can land at the same spot — so the generation index
          // (stable for a given square, since cloudBlobsForSquare always
          // returns blobs in the same order) is used instead.
          key={index}
          blob={blob}
          driftProgress={driftProgress}
          squareSize={squareSize}
        />
      ))}
    </View>
  );
}

function CloudBlobLayer({
  blob,
  driftProgress,
  squareSize,
}: {
  blob: CloudBlob;
  driftProgress: SharedValue<number>;
  squareSize: number;
}): React.JSX.Element {
  const animatedStyle = useAnimatedStyle(() => {
    const angle = driftProgress.value * Math.PI * 2 + blob.driftPhase;
    const amplitude = (DRIFT_AMPLITUDE_PCT / 100) * squareSize;
    return {
      transform: [
        { rotate: `${blob.rotateDeg}deg` },
        { translateX: Math.sin(angle) * amplitude },
        { translateY: Math.cos(angle) * amplitude },
      ],
    };
  });
  return (
    <Animated.View
      className='absolute rounded-full bg-fog'
      style={[
        {
          left: `${blob.cx - blob.width / 2}%`,
          top: `${blob.cy - blob.height / 2}%`,
          width: `${blob.width}%`,
          height: `${blob.height}%`,
          opacity: blob.opacity,
        },
        animatedStyle,
      ]}
    />
  );
}
