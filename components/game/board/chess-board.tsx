import * as React from 'react';
import { View } from 'react-native';
import { Chess, Square } from 'chess.js';
import { Text } from '~/components/ui/text';
import type { PlayerColor } from '~/types/game';

type Props = {
  fen: string;
  onMove: (from: string, to: string) => void;
  orientation: PlayerColor;
};

export function ChessBoard({ fen, onMove, orientation }: Props) {
  const [selectedSquare, setSelectedSquare] = React.useState<Square | null>(
    null,
  );
  const chess = new Chess(fen);

  const handleSquarePress = (square: Square) => {
    if (!selectedSquare) {
      setSelectedSquare(square);
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    onMove(selectedSquare, square);
    setSelectedSquare(null);
  };

  return (
    <View className='w-full aspect-square'>
      <View className='flex-row flex-wrap flex-1'>
        {Array.from({ length: 8 }).map((_, rank) =>
          Array.from({ length: 8 }).map((_, file) => {
            const square =
              `${String.fromCharCode(97 + file)}${8 - rank}` as Square;
            const isLight = (rank + file) % 2 === 0;
            const piece = chess.get(square);

            return (
              <View
                key={square}
                className={`w-1/8 h-1/8 ${
                  isLight ? 'bg-amber-100' : 'bg-amber-800'
                } ${selectedSquare === square ? 'bg-blue-500' : ''}`}
                onTouchEnd={() => handleSquarePress(square)}
              >
                {piece && (
                  <Text className='text-4xl text-center'>
                    {getPieceSymbol(piece)}
                  </Text>
                )}
              </View>
            );
          }),
        )}
      </View>
    </View>
  );
}

function getPieceSymbol(piece: { type: string; color: string }) {
  const symbols = {
    p: '♟',
    n: '♞',
    b: '♝',
    r: '♜',
    q: '♛',
    k: '♚',
  };

  const symbol = symbols[piece.type as keyof typeof symbols];
  return piece.color === 'w' ? symbol : symbol?.toLowerCase();
}
