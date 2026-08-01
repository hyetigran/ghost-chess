import * as React from 'react';
import { View } from 'react-native';
import { Chess, Square } from 'chess.js';
import { Text } from '~/components/ui/text';
import { squareAt, type Orientation } from '~/lib/game/board-geometry';

type Props = {
  /**
   * The FEN this board renders — always the caller's own redacted view
   * (player_views.redacted_fen), never the true game state (ADR-0001).
   * This component has no way to enforce that itself — it renders
   * whatever FEN it's handed — the actual guarantee lives at the caller
   * (src/api/server/game.ts's getGame reads player_views only, #12).
   * Named explicitly rather than a generic `fen` so a future caller can't
   * casually wire in the true games.fen without the prop name itself
   * being a hint that something's wrong.
   */
  redactedFen: string;
  onMove: (from: string, to: string) => void;
  orientation: Orientation;
};

export function ChessBoard({ redactedFen, onMove, orientation }: Props) {
  const [selectedSquare, setSelectedSquare] = React.useState<Square | null>(
    null,
  );
  const chess = React.useMemo(() => new Chess(redactedFen), [redactedFen]);
  const ownColor = orientation === 'white' ? 'w' : 'b';

  // Legal destinations for the selected piece (PRD §5.1's "visual
  // indicators for... legal moves"). This is a client-side UX aid built
  // from the player's own redacted view, not a pre-flight legality check
  // against hidden state — it can only ever compute moves chess.js can
  // already see in redactedFen, so it can't disclose anything about an
  // opponent's hidden pieces.
  const legalTargets = React.useMemo(() => {
    if (!selectedSquare) return new Set<Square>();
    return new Set(
      chess
        .moves({ square: selectedSquare, verbose: true })
        .map((move) => move.to as Square),
    );
  }, [chess, selectedSquare]);

  const handleSquarePress = (square: Square) => {
    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    const piece = chess.get(square);

    if (selectedSquare) {
      if (legalTargets.has(square)) {
        onMove(selectedSquare, square);
        setSelectedSquare(null);
        return;
      }
      // Tapping another of the player's own pieces re-selects instead of
      // attempting an illegal move to it.
      setSelectedSquare(piece?.color === ownColor ? square : null);
      return;
    }

    // Only the player's own pieces are selectable — the viewer can't see
    // the opponent's pieces at all under occlusion (Visibility,
    // CONTEXT.md), so there's nothing to select there anyway, but this
    // also stops an empty square from ever becoming a "selection".
    if (piece?.color === ownColor) {
      setSelectedSquare(square);
    }
  };

  return (
    <View className='w-full aspect-square'>
      <View className='flex-row flex-wrap flex-1'>
        {Array.from({ length: 8 }).map((_, displayRank) =>
          Array.from({ length: 8 }).map((_, displayFile) => {
            const square = squareAt(displayRank, displayFile, orientation);
            const isLight = (displayRank + displayFile) % 2 === 0;
            const piece = chess.get(square);
            const isSelected = selectedSquare === square;
            const isLegalTarget = legalTargets.has(square);

            return (
              <View
                key={square}
                className={`w-[12.5%] h-[12.5%] items-center justify-center ${
                  isLight ? 'bg-amber-100' : 'bg-amber-800'
                } ${isSelected ? 'bg-blue-500' : ''} ${
                  isLegalTarget ? 'bg-green-400' : ''
                }`}
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
