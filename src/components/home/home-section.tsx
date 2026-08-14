import * as React from 'react';
import { View } from 'react-native';
import { SectionLabel } from '~/components/ui';

type Props = {
  title: string;
  /** Optional right-aligned mono annotation (e.g. "1 EXPIRING"). */
  trailing?: React.ReactNode;
  children: React.ReactNode;
};

// Mockup sections aren't cards — a mono eyebrow label sits directly on
// the screen background with the section's rows below it.
export function HomeSection({
  title,
  trailing,
  children,
}: Props): React.JSX.Element {
  return (
    <View className='w-full mb-[18px] gap-2.5'>
      <View className='flex-row items-baseline justify-between'>
        <SectionLabel>{title}</SectionLabel>
        {trailing}
      </View>
      {children}
    </View>
  );
}
