import * as React from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { type Square } from 'chess.js';
import {
  BASE_FILL_OVERHANG_PCT,
  DRIFT_AMPLITUDE_PCT,
  squareFogLayout,
  type CloudBlob,
} from '~/lib/game/cloud-fog';

type Props = {
  square: Square;
  /**
   * 0→1 sawtooth shared across every hazy square on the board (driven
   * once in chess-board.tsx). Turned into this square's own drift via
   * `sin(progress · 2π + driftPhase)`, so one UI-thread animation clock
   * — not one per square — is enough to make the whole board's haze
   * drift, regardless of how many squares are currently hazy.
   */
  driftProgress: SharedValue<number>;
  /** Current pixel size of one square — drift is expressed in pixels
   * (Reanimated transforms don't accept percentage strings on native),
   * while every other dimension below is a plain percentage string so
   * it scales with the square's own layout. */
  squareSize: number;
};

/**
 * Cloud-like haze for a single hazy square: a full-coverage base fill
 * (guarantees the square never shows bare checker, regardless of where
 * the decorative blobs land) topped with a few overlapping, irregular,
 * semi-transparent texture blobs — replaces the old flat `bg-fog` fill
 * (issue #77) and the later blobs-only version, which could leave gaps
 * (issue: fog must fill the entire square). The whole patch — base fill
 * and every blob — drifts together as one unit via a single transform on
 * the shared inner container, so it reads as one slowly moving patch of
 * fog rather than independently shimmering pieces. Membership (which
 * squares get this at all) is untouched here; that's `isHazy` in
 * chess-board.tsx / #78's concern, not this component's.
 */
export function CloudFogOverlay({
  square,
  driftProgress,
  squareSize,
}: Props): React.JSX.Element {
  const { baseOpacity, driftPhase, blobs } = React.useMemo(
    () => squareFogLayout(square),
    [square],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const angle = driftProgress.value * Math.PI * 2 + driftPhase;
    const amplitude = (DRIFT_AMPLITUDE_PCT / 100) * squareSize;
    return {
      transform: [
        { translateX: Math.sin(angle) * amplitude },
        { translateY: Math.cos(angle) * amplitude },
      ],
    };
  });

  return (
    <View className='absolute inset-0 overflow-hidden' pointerEvents='none'>
      <Animated.View className='absolute inset-0' style={animatedStyle}>
        <View
          className='absolute bg-fog'
          style={{
            top: `-${BASE_FILL_OVERHANG_PCT}%`,
            left: `-${BASE_FILL_OVERHANG_PCT}%`,
            width: `${100 + BASE_FILL_OVERHANG_PCT * 2}%`,
            height: `${100 + BASE_FILL_OVERHANG_PCT * 2}%`,
            opacity: baseOpacity,
          }}
        />
        {blobs.map((blob, index) => (
          // Position alone isn't a stable key — two blobs on the same
          // square can land at the same spot — so the generation index
          // (stable for a given square, since squareFogLayout always
          // returns blobs in the same order) is used instead.
          <CloudBlobLayer key={index} blob={blob} />
        ))}
      </Animated.View>
    </View>
  );
}

function CloudBlobLayer({ blob }: { blob: CloudBlob }): React.JSX.Element {
  return (
    <View
      className='absolute rounded-full bg-fog'
      style={{
        left: `${blob.cx - blob.width / 2}%`,
        top: `${blob.cy - blob.height / 2}%`,
        width: `${blob.width}%`,
        height: `${blob.height}%`,
        opacity: blob.opacity,
        transform: [{ rotate: `${blob.rotateDeg}deg` }],
      }}
    />
  );
}
