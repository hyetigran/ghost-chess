import * as React from 'react';
import { Image, Pressable, View } from 'react-native';
import { Text } from '~/components/ui/text';
import { pieceImage } from '~/lib/game/piece-image';
import { PROMOTION_PIECES, type PromotionPiece } from '~/lib/game/promotion';

const PIECE_LABELS: Record<PromotionPiece, string> = {
  q: 'queen',
  r: 'rook',
  n: 'knight',
  b: 'bishop',
};

type Props = {
  color: 'w' | 'b';
  onPick: (piece: PromotionPiece) => void;
  onCancel: () => void;
};

// An overlay inside the board itself rather than a Dialog: the choice is
// about squares the player is already looking at, and every board surface
// (online, local, AI) gets it without each screen mounting its own Dialog
// root. Tapping outside the row cancels — same as tapping away from a
// selected piece.
export function PromotionPicker({
  color,
  onPick,
  onCancel,
}: Props): React.JSX.Element {
  return (
    <Pressable
      className='absolute inset-0 z-20 items-center justify-center bg-black/50'
      onPress={onCancel}
      accessibilityLabel='Cancel promotion'
    >
      <View className='items-center gap-2 p-4 border rounded-lg border-border bg-background shadow-lg'>
        <Text className='text-sm font-semibold text-muted-foreground'>
          Promote to
        </Text>
        <View className='flex-row gap-2'>
          {PROMOTION_PIECES.map((piece) => (
            <Pressable
              key={piece}
              onPress={() => onPick(piece)}
              accessibilityLabel={`Promote to ${PIECE_LABELS[piece]}`}
              className='items-center justify-center w-14 h-14 rounded-md bg-squareLight active:bg-highlight'
            >
              <Image
                source={pieceImage({ type: piece, color })}
                style={{ width: '80%', height: '80%' }}
                resizeMode='contain'
              />
            </Pressable>
          ))}
        </View>
      </View>
    </Pressable>
  );
}
