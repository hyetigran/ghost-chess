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
import { legalTargetSquares } from '~/lib/game/legal-target-squares';
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
  const ownPieceColor = orientation === 'white' ? 'w' : 'b';
  // Fog/haze rule: a square is NOT hazy iff one of the viewer's own
  // pieces could currently move there (legal-target-squares.ts) — every
  // other square gets the haze, whether it's genuinely empty or hiding an
  // enemy piece; the board can't tell those apart any more than the
  // player can. Own pieces are always "known," so they're never hazy
  // regardless of this set. Deliberately not the same set as ADR-0008's
  // attack-based vision (computeVisibleSquares, redact-fen.ts) — that
  // still governs what's actually revealed server-side; this only
  // governs the board's visual haze, and includes e.g. a pawn's forward
  // push square, which is a legal destination but not a vision square.
  const reachableSquares = React.useMemo(
    () => legalTargetSquares(chess, ownPieceColor),
    [chess, ownPieceColor],
  );
  // Every caller sets `interactive` to false exactly when `redactedFen`
  // has stopped being redacted (ADR-0003's reveal-on-completion, for the
  // online screen; local/AI games never render this component at all
  // once they're over, only mid-game history review, which is still
  // genuinely occluded) — showing fog over an already-fully-revealed
  // position would misrepresent it as still uncertain, so fog is skipped
  // entirely once `interactive` is false rather than computed and hidden.
  const fogEnabled = interactive;

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
                const isHazy =
                  fogEnabled &&
                  piece?.color !== ownPieceColor &&
                  !reachableSquares.has(square);

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
                    {/* A translucent haze layered over the tile rather
                        than a flat color swap, so the light/dark checker
                        pattern (and any highlight underneath) still shows
                        faintly through — reads as "this square is
                        obscured," not "this is a third square color."
                        pointerEvents="none" so the overlay never steals
                        the tap from the Pressable it sits on. */}
                    {isHazy && (
                      <View
                        className='absolute inset-0 opacity-80 bg-fog'
                        pointerEvents='none'
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
