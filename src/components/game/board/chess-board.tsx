import * as React from 'react';
import { View } from 'react-native';
import { Chess } from 'chess.js';
import { Text } from '~/components/ui/text';
import { squareAt, type Orientation } from '~/lib/game/board-geometry';
import { pieceSymbol } from '~/lib/game/piece-symbol';
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
};

export function ChessBoard({
  redactedFen,
  onMove,
  orientation,
}: Props): React.JSX.Element {
  // skipValidation: a redacted FEN structurally omits the opponent's
  // king along with every other opponent piece (redact_fen,
  // supabase/schemas/06_functions.sql) — it's never a "complete legal
  // position" by chess.js's own definition, so the default strict
  // validation throws ("Invalid FEN: missing black king") on every real
  // active game with anything hidden, i.e. nearly always. Reading pieces
  // and generating moves for the viewer's own pieces both still work
  // correctly without it.
  const chess = React.useMemo(
    () => new Chess(redactedFen, { skipValidation: true }),
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
