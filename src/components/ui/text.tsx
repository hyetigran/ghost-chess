import * as Slot from '@rn-primitives/slot';
import type { SlottableTextProps, TextRef } from '@rn-primitives/types';
import * as React from 'react';
import { Text as RNText } from 'react-native';
import { cn } from '~/lib/style/utils';

const TextClassContext = React.createContext<string | undefined>(undefined);

const Text = React.forwardRef<TextRef, SlottableTextProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const textClass = React.useContext(TextClassContext);
    const Component = asChild ? Slot.Text : RNText;
    return (
      <Component
        className={cn(
          'font-sans text-base text-foreground web:select-text',
          textClass,
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Text.displayName = 'Text';

// The mockup's recurring eyebrow label: IBM Plex Mono 600 11px, +0.08em
// tracking, uppercase, faint ink — "YOUR MOVE", "TIME CONTROL", "OPPONENT".
const SectionLabel = React.forwardRef<TextRef, SlottableTextProps>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref}
      className={cn(
        'font-mono-semibold text-[11px] uppercase tracking-[0.88px] text-faint',
        className,
      )}
      {...props}
    />
  ),
);
SectionLabel.displayName = 'SectionLabel';

export { SectionLabel, Text, TextClassContext };
