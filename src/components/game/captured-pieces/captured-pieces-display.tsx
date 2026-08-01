import * as React from 'react';
import { View } from 'react-native';
import { Text } from '~/components/ui/text';
import { pieceSymbol } from '~/lib/game/piece-symbol';

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
          <Text key={`white-${index}`} className='text-2xl'>
            {pieceSymbol({ type, color: 'b' })}
          </Text>
        ))}
      </View>
      <View className='flex-row gap-1'>
        {capturedByBlack.map((type, index) => (
          <Text key={`black-${index}`} className='text-2xl'>
            {pieceSymbol({ type, color: 'w' })}
          </Text>
        ))}
      </View>
    </View>
  );
}
