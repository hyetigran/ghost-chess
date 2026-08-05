import * as React from 'react';
import { Image, Pressable, View } from 'react-native';
import { type Square } from 'chess.js';
import { Text } from '~/components/ui/text';
import {
  fileLabels,
  rankLabels,
  squareAt,
  type Orientation,
} from '~/lib/game/board-geometry';
import { pieceImage } from '~/lib/game/piece-image';
import { chessFromRedactedFen } from '~/lib/game/redacted-chess';
import { useSquareSelection } from '~/lib/hooks/use-square-selection';

const LABEL_GUTTER = 16;

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
  /**
   * False once a game is no longer active (#19) — `redactedFen` stops
   * being redacted at that point (ADR-0003) and this same board becomes
   * the post-game final-position view, so taps must stop being treated
   * as move attempts rather than just relying on the server to reject
   * them.
   */
  interactive?: boolean;
  /** Label shown over the board while `interactive` is false. */
  inactiveLabel?: string;
};

export function ChessBoard({
  redactedFen,
  onMove,
  orientation,
  flashSquare,
  interactive = true,
  inactiveLabel = 'Final position',
}: Props): React.JSX.Element {
  const chess = React.useMemo(
    () => chessFromRedactedFen(redactedFen),
    [redactedFen],
  );
  const { selectedSquare, legalTargets, handleSquarePress } =
    useSquareSelection(chess, orientation, onMove);

  return (
    <View
      className={`w-full max-w-[560px] self-center ${interactive ? '' : 'opacity-70'}`}
    >
      {!interactive && (
        <View className='absolute inset-x-0 z-10 items-center -top-7'>
          <Text className='text-xs font-semibold tracking-wide uppercase text-muted-foreground'>
            {inactiveLabel}
          </Text>
        </View>
      )}
      <View className='flex-row'>
        <View style={{ width: LABEL_GUTTER }}>
          {rankLabels(orientation).map((rank) => (
            <View key={rank} className='items-center justify-center flex-1'>
              <Text className='text-xs text-muted-foreground'>{rank}</Text>
            </View>
          ))}
        </View>
        <View className='flex-1 aspect-square'>
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
                  <Pressable
                    key={square}
                    className={`w-[12.5%] h-[12.5%] items-center justify-center ${
                      isLight ? 'bg-squareLight' : 'bg-squareDark'
                    } ${isSelected ? 'bg-highlight' : ''} ${
                      isLegalTarget ? 'bg-accent' : ''
                    } ${isFlashing ? 'bg-danger' : ''}`}
                    onPress={() => interactive && handleSquarePress(square)}
                  >
                    {piece && (
                      <Image
                        source={pieceImage(piece)}
                        style={{ width: '80%', height: '80%' }}
                        resizeMode='contain'
                      />
                    )}
                  </Pressable>
                );
              }),
            )}
          </View>
        </View>
      </View>
      <View className='flex-row'>
        <View style={{ width: LABEL_GUTTER }} />
        <View className='flex-row flex-1'>
          {fileLabels(orientation).map((file) => (
            <View key={file} className='items-center justify-center flex-1'>
              <Text className='text-xs text-muted-foreground'>
                {file.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
