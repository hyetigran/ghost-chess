import * as React from 'react';
import { Image, View } from 'react-native';
import { squareAt, type Orientation } from '~/lib/game/board-geometry';
import { pieceImage } from '~/lib/game/piece-image';
import { chessFromRedactedFen } from '~/lib/game/redacted-chess';

type Props = {
  /** Always the caller's own redacted view, same rule as ChessBoard. */
  redactedFen: string;
  orientation: Orientation;
  /** Square size in px — the whole thumbnail is 8x this. Defaults to the
   * turn-queue row's size (46px square per the design spec / 8). */
  size?: number;
};

// A small, static, non-interactive rendering of the actual position for a
// game-queue row — deliberately reuses chessFromRedactedFen/pieceImage
// (same as ChessBoard) rather than a placeholder pattern, so what shows
// here is the real, current position at a glance, not a decorative
// stand-in. No touch handling, no labels, no selection/legal-target/fog
// state — this is read-only.
export function BoardThumbnail({
  redactedFen,
  orientation,
  size = 46,
}: Props): React.JSX.Element {
  const chess = React.useMemo(
    () => chessFromRedactedFen(redactedFen),
    [redactedFen],
  );
  const squareSize = size / 8;

  return (
    <View
      className='overflow-hidden rounded-tile'
      style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap' }}
    >
      {Array.from({ length: 8 }).map((_, displayRank) =>
        Array.from({ length: 8 }).map((_, displayFile) => {
          const square = squareAt(displayRank, displayFile, orientation);
          const isLight = (displayRank + displayFile) % 2 === 0;
          const piece = chess.get(square);

          return (
            <View
              key={square}
              className={isLight ? 'bg-squareLight' : 'bg-squareDark'}
              style={{
                width: squareSize,
                height: squareSize,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {piece && (
                <Image
                  source={pieceImage(piece)}
                  style={{ width: squareSize * 0.85, height: squareSize * 0.85 }}
                  resizeMode='contain'
                />
              )}
            </View>
          );
        }),
      )}
    </View>
  );
}
