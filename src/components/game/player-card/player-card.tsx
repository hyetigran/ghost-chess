import * as React from 'react';
import { Image, View } from 'react-native';
import { Text } from '~/components/ui';
import { pieceImage } from '~/lib/game/piece-image';
import { avatarColor, initials } from '~/lib/user/avatar';
import { formatUsername } from '~/lib/user/format-username';

type Props = {
  /** null while a game is still 'waiting' for a second player to join. */
  username: string | null;
  eloRating: number | null;
  isYou: boolean;
  /** Piece types this player has captured — rendered as a small trophy
   * line under the name, per the mockup's "♟♟♝" row. */
  capturedTypes?: string[];
  /** Color of the pieces in capturedTypes (the opponent's color). */
  capturedColor?: 'w' | 'b';
  /** Formatted clock ("4:12") or null to show the waiting em dash. */
  clock?: string | null;
  /** Mockup: the viewer's running clock is the solid accent chip; every
   * other clock is a muted neutral chip. */
  clockActive?: boolean;
};

// Mockup player row: 40px squircle initials tile, Manrope 700 name with
// a mono rating beside it, captured-piece line underneath, mono clock
// chip on the right. Initials tile keeps the deterministic
// avatarColor(username) fill (no photo-upload feature exists).
export function PlayerCard({
  username,
  eloRating,
  isYou,
  capturedTypes = [],
  capturedColor,
  clock,
  clockActive = false,
}: Props): React.JSX.Element {
  return (
    <View className='flex-row items-center gap-3'>
      <View
        className='items-center justify-center w-10 h-10 rounded-tile'
        style={{ backgroundColor: username ? avatarColor(username) : '#9CA3AF' }}
      >
        <Text className='font-sans-bold text-[15px] text-white'>
          {username ? initials(username) : '?'}
        </Text>
      </View>
      <View className='flex-1 gap-[3px]'>
        <View className='flex-row items-center gap-1.5'>
          <Text className='font-sans-bold text-base'>
            {username ? formatUsername(username) : 'Waiting for opponent…'}
            {isYou ? ' (you)' : ''}
          </Text>
          {eloRating !== null && (
            <Text className='font-mono text-[13px] text-faint'>
              {eloRating}
            </Text>
          )}
        </View>
        <View className='flex-row items-center gap-0.5 h-[14px]'>
          {capturedColor &&
            capturedTypes.map((type, index) => (
              <Image
                key={`${type}-${index}`}
                source={pieceImage({ type, color: capturedColor })}
                style={{ width: 14, height: 14, opacity: 0.55 }}
                resizeMode='contain'
              />
            ))}
        </View>
      </View>
      {clock !== undefined && (
        <View
          className={`rounded-tile px-3.5 py-2 ${
            clockActive ? 'bg-primary shadow-raised' : 'bg-muted'
          }`}
        >
          <Text
            className={`font-mono-semibold text-xl tracking-[-0.4px] ${
              clockActive ? 'text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            {clock ?? '—'}
          </Text>
        </View>
      )}
    </View>
  );
}
