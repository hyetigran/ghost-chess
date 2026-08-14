import * as SwitchPrimitives from '@rn-primitives/switch';
import * as React from 'react';
import { Platform } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { useColorScheme } from '~/lib/style/useColorScheme';
import { cn } from '~/lib/style/utils';

// Mockup switch spec: 52x31 track, radius 16, 3px inner padding, 25px
// thumb. Light thumb stays white in both states; dark thumb is the bg
// color when on and muted when off (per the dark "Who can accept" rows).

const SwitchWeb = React.forwardRef<
  SwitchPrimitives.RootRef,
  SwitchPrimitives.RootProps
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer flex-row h-[31px] w-[52px] shrink-0 cursor-pointer items-center rounded-chip p-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed',
      props.checked ? 'bg-primary' : 'bg-borderStrong',
      props.disabled && 'opacity-50',
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-[25px] w-[25px] rounded-full shadow-md shadow-foreground/25 ring-0 transition-transform',
        'bg-white dark:bg-muted-foreground',
        props.checked && 'translate-x-[21px] dark:bg-background',
      )}
    />
  </SwitchPrimitives.Root>
));

SwitchWeb.displayName = 'SwitchWeb';

// Raw track colors for the animated interpolation — hex versions of
// --dt-accent / --dt-border-strong per scheme (reanimated can't read
// CSS vars).
const RGB_COLORS = {
  light: {
    primary: 'rgb(79, 122, 59)', // #4F7A3B
    input: 'rgb(216, 212, 202)', // #D8D4CA
  },
  dark: {
    primary: 'rgb(111, 162, 76)', // #6FA24C
    input: 'rgb(58, 65, 73)', // #3A4149
  },
} as const;

const THUMB_TRAVEL = 21; // 52 track - 25 thumb - 2*3 padding

const SwitchNative = React.forwardRef<
  SwitchPrimitives.RootRef,
  SwitchPrimitives.RootProps
>(({ className, ...props }, ref) => {
  const { colorScheme } = useColorScheme();
  const translateX = useDerivedValue(() =>
    props.checked ? THUMB_TRAVEL : 0,
  );
  const animatedRootStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        translateX.value,
        [0, THUMB_TRAVEL],
        [RGB_COLORS[colorScheme].input, RGB_COLORS[colorScheme].primary],
      ),
    };
  });
  const animatedThumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: withTiming(translateX.value, { duration: 180 }) },
    ],
  }));
  return (
    <Animated.View
      style={animatedRootStyle}
      className={cn(
        'h-[31px] w-[52px] rounded-chip',
        props.disabled && 'opacity-50',
      )}
    >
      <SwitchPrimitives.Root
        className={cn(
          'flex-row h-[31px] w-[52px] shrink-0 items-center rounded-chip p-[3px]',
          className,
        )}
        {...props}
        ref={ref}
      >
        <Animated.View style={animatedThumbStyle}>
          <SwitchPrimitives.Thumb
            className={cn(
              'h-[25px] w-[25px] rounded-full shadow-md shadow-black/25 ring-0',
              'bg-white dark:bg-muted-foreground',
              props.checked && 'dark:bg-background',
            )}
          />
        </Animated.View>
      </SwitchPrimitives.Root>
    </Animated.View>
  );
});
SwitchNative.displayName = 'SwitchNative';

const Switch = Platform.select({
  web: SwitchWeb,
  default: SwitchNative,
});

export { Switch };
