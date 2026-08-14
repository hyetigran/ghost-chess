import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Card, CardContent, CardHeader, SectionLabel, Text } from '~/components/ui';
import { pairMoves, type MoveCell, type MoveEntry } from '~/lib/game/pair-moves';

type Props = {
  moves: MoveEntry[];
  /** null = viewing the live/latest position. */
  viewingPly: number | null;
  /** Called with a move's ply to browse that position, or null for "back to live". */
  onSelectPly: (ply: number | null) => void;
};

// Below the board on narrow screens (w-full max-w-[560px] self-center,
// matching ChessBoard's own sizing), a fixed-width sidebar to the board's
// right from the lg breakpoint up — the standard board+move-list layout.
// The row list itself scrolls within a capped height rather than growing
// unbounded (taller on lg, since it sits beside the ~560px board rather
// than below it); auto-scrolls to the newest move as one is added, but
// only while viewing live — jumping the scroll position while someone is
// deliberately browsing an earlier move would fight their own scrolling.
export function MoveHistory({
  moves,
  viewingPly,
  onSelectPly,
}: Props): React.JSX.Element | null {
  const scrollRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    if (viewingPly === null) scrollRef.current?.scrollToEnd({ animated: true });
  }, [moves.length, viewingPly]);

  if (moves.length === 0) return null;

  const rows = pairMoves(moves);

  const renderCell = (cell: MoveCell | undefined): React.JSX.Element | null => {
    if (!cell) return null;
    const isViewing = viewingPly === cell.ply;
    return (
      <Pressable
        className={`flex-1 rounded px-1.5 ${isViewing ? 'bg-accent' : ''}`}
        onPress={() => onSelectPly(cell.ply)}
      >
        <Text
          className={`font-mono text-[13px] ${
            isViewing ? 'font-mono-semibold text-accent-foreground' : ''
          }`}
        >
          {cell.san}
        </Text>
      </Pressable>
    );
  };

  return (
    <Card className='w-full max-w-[560px] self-center mt-4 lg:mt-0 lg:w-72 lg:max-w-none lg:self-start rounded-2xl'>
      <CardHeader className='flex-row items-center justify-between px-4 py-3'>
        <SectionLabel>Moves</SectionLabel>
        {viewingPly !== null && (
          <Pressable onPress={() => onSelectPly(null)}>
            <Text className='font-sans-semibold text-sm text-primary'>
              Back to live
            </Text>
          </Pressable>
        )}
      </CardHeader>
      <CardContent className='p-0'>
        <ScrollView ref={scrollRef} className='max-h-40 lg:max-h-[520px]'>
          <View className='px-4 pb-3'>
            {rows.map((row) => (
              <View key={row.number} className='flex-row py-1'>
                <Text className='w-8 font-mono text-[13px] text-faint'>
                  {row.number}.
                </Text>
                {renderCell(row.white)}
                {renderCell(row.black)}
              </View>
            ))}
          </View>
        </ScrollView>
      </CardContent>
    </Card>
  );
}
