import * as React from 'react';
import { View } from 'react-native';
import { type Square } from 'chess.js';
import { Text } from '~/components/ui/text';
import { squareAt, type Orientation } from '~/lib/game/board-geometry';
import { pieceSymbol } from '~/lib/game/piece-symbol';
import { chessFromRedactedFen } from '~/lib/game/redacted-chess';
import { useSquareSelection } from '~/lib/hooks/use-square-selection';

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
  /** Briefly highlighted on a capture (src/lib/hooks/use-capture-flash.ts, #18). */
  flashSquare?: Square | null;
};

export function ChessBoard({
  redactedFen,
  onMove,
  orientation,
  flashSquare,
}: Props): React.JSX.Element {
  const chess = React.useMemo(
    () => chessFromRedactedFen(redactedFen),
    [redactedFen],
  );
  const { selectedSquare, legalTargets, handleSquarePress } =
    useSquareSelection(chess, orientation, onMove);

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
            const isFlashing = flashSquare === square;

            return (
              <View
                key={square}
                className={`w-[12.5%] h-[12.5%] items-center justify-center ${
                  isLight ? 'bg-amber-100' : 'bg-amber-800'
                } ${isSelected ? 'bg-blue-500' : ''} ${
                  isLegalTarget ? 'bg-green-400' : ''
                } ${isFlashing ? 'bg-red-400' : ''}`}
                onTouchEnd={() => handleSquarePress(square)}
              >
                {piece && (
                  <Text className='text-4xl text-center'>
                    {pieceSymbol(piece)}
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
