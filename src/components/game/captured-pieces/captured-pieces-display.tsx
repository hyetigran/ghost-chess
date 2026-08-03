import * as React from 'react';
import { Image, View } from 'react-native';
import { pieceImage } from '~/lib/game/piece-image';

type Props = {
  /** Piece types white has captured — always black's pieces. */
  capturedByWhite: string[];
  /** Piece types black has captured — always white's pieces. */
  capturedByBlack: string[];
};

export function CapturedPieces({
  capturedByWhite,
  capturedByBlack,
}: Props): React.JSX.Element {
  return (
    <View className='flex-row justify-between p-4'>
      <View className='flex-row gap-1'>
        {capturedByWhite.map((type, index) => (
          <Image
            key={`white-${index}`}
            source={pieceImage({ type, color: 'b' })}
            style={{ width: 24, height: 24 }}
            resizeMode='contain'
          />
        ))}
      </View>
      <View className='flex-row gap-1'>
        {capturedByBlack.map((type, index) => (
          <Image
            key={`black-${index}`}
            source={pieceImage({ type, color: 'w' })}
            style={{ width: 24, height: 24 }}
            resizeMode='contain'
          />
        ))}
      </View>
    </View>
  );
}
