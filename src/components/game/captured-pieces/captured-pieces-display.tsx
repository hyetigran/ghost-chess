import * as React from 'react';
import { View } from 'react-native';
import { Text } from '~/components/ui/text';

type Props = {
  whitePieces: string[];
  blackPieces: string[];
};

export function CapturedPieces({ whitePieces, blackPieces }: Props) {
  return (
    <View className='flex-row justify-between p-4'>
      <View className='flex-row gap-1'>
        {whitePieces.map((piece, index) => (
          <Text key={`white-${index}`} className='text-2xl'>
            {getPieceSymbol(piece)}
          </Text>
        ))}
      </View>
      <View className='flex-row gap-1'>
        {blackPieces.map((piece, index) => (
          <Text key={`black-${index}`} className='text-2xl'>
            {getPieceSymbol(piece)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function getPieceSymbol(piece: string) {
  const symbols = {
    P: '♟',
    N: '♞',
    B: '♝',
    R: '♜',
    Q: '♛',
    K: '♚',
  };

  return symbols[piece as keyof typeof symbols] || piece;
}
