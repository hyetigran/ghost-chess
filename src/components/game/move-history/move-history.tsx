import * as React from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { Card, CardContent, CardHeader, SectionLabel, Text } from '~/components/ui';
import { ChevronLeft } from '~/lib/icons/ChevronLeft';
import { ChevronRight } from '~/lib/icons/ChevronRight';
import { pairMoves, type MoveCell, type MoveEntry, type MoveRow } from '~/lib/game/pair-moves';
import { stepViewingPly } from '~/lib/game/ply-navigation';
import { cn } from '~/lib/style/utils';

type Props = {
  moves: MoveEntry[];
  /** null = viewing the live/latest position. */
  viewingPly: number | null;
  /** Called with a move's ply to browse that position, or null for "back to live". */
  onSelectPly: (ply: number | null) => void;
  /**
   * 'vertical' (default): the sidebar/below-board card, unchanged from
   * before #85. 'horizontal': the mobile strip above `ChessBoard` (#85) —
   * same cells, same `bg-accent` highlight, laid out as a single
   * horizontally-scrolling row instead of stacked numbered rows, since a
   * vertical card doesn't fit above the board on a narrow screen.
   */
  orientation?: 'vertical' | 'horizontal';
  /**
   * Merged onto the root `Card`'s className (e.g. the game screen's
   * `hidden lg:flex` for the desktop-only sidebar instance). Applied
   * directly here rather than via a wrapping `<View>` at the call site
   * so it composes with this component's own responsive width/alignment
   * classes (`lg:self-start` etc.) instead of adding an extra flex
   * child that would need its own alignment worked out.
   */
  className?: string;
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
  orientation = 'vertical',
  className,
}: Props): React.JSX.Element | null {
  const scrollRef = React.useRef<ScrollView>(null);
  // Row-number -> x-offset within the horizontal ScrollView's content,
  // captured as each row lays out. Only meaningful (and only populated)
  // in 'horizontal' mode — the vertical card scrolls to the bottom by
  // length alone (below) and has no need for per-row x offsets.
  const rowOffsets = React.useRef<Map<number, number>>(new Map());

  const rows = React.useMemo(() => pairMoves(moves), [moves]);

  React.useEffect(() => {
    if (orientation === 'vertical' && viewingPly === null) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [orientation, moves.length, viewingPly]);

  // Auto-scroll the active ply's row into view (#85 task). Runs off the
  // *row* the active ply belongs to, not the individual white/black cell
  // — cheap to find, and both cells in a row sit close enough together
  // that scrolling the row into view puts the active cell in view too.
  React.useEffect(() => {
    if (orientation !== 'horizontal') return;
    const targetRow =
      viewingPly === null
        ? rows[rows.length - 1]
        : rows.find(
            (row) => row.white?.ply === viewingPly || row.black?.ply === viewingPly,
          );
    if (!targetRow) return;
    const x = rowOffsets.current.get(targetRow.number);
    if (x === undefined) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
  }, [orientation, viewingPly, rows]);

  if (moves.length === 0) return null;

  const renderCell = (cell: MoveCell | undefined): React.JSX.Element | null => {
    if (!cell) return null;
    const isViewing = viewingPly === cell.ply;
    return (
      <Pressable
        className={cn(
          'rounded px-1.5',
          orientation === 'vertical' && 'flex-1',
          isViewing && 'bg-accent',
        )}
        onPress={() => onSelectPly(cell.ply)}
      >
        <Text
          className={cn(
            'font-mono text-[13px]',
            isViewing && 'font-mono-semibold text-accent-foreground',
          )}
        >
          {cell.san}
        </Text>
      </Pressable>
    );
  };

  const handlePrev = (): void => {
    onSelectPly(stepViewingPly(viewingPly, moves.length, 'prev'));
  };
  const handleNext = (): void => {
    onSelectPly(stepViewingPly(viewingPly, moves.length, 'next'));
  };
  // Disabled exactly when stepping wouldn't move anywhere (ply-navigation's
  // clamp-at-the-ends behavior) — same condition either direction, so no
  // separate "am I at the first/last ply" check is needed here.
  const prevDisabled =
    stepViewingPly(viewingPly, moves.length, 'prev') === viewingPly;
  const nextDisabled =
    stepViewingPly(viewingPly, moves.length, 'next') === viewingPly;

  const chevronButton = (
    direction: 'prev' | 'next',
    disabled: boolean,
  ): React.JSX.Element => (
    <Pressable
      onPress={direction === 'prev' ? handlePrev : handleNext}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      className='items-center justify-center w-7 h-7'
    >
      {direction === 'prev' ? (
        <ChevronLeft
          size={16}
          className={disabled ? 'text-faint' : 'text-foreground'}
        />
      ) : (
        <ChevronRight
          size={16}
          className={disabled ? 'text-faint' : 'text-foreground'}
        />
      )}
    </Pressable>
  );

  const header = (
    <CardHeader
      className={cn(
        'flex-row items-center justify-between px-4 py-3',
        orientation === 'horizontal' && 'py-2',
      )}
    >
      <SectionLabel>Moves</SectionLabel>
      <View className='flex-row items-center gap-1'>
        {chevronButton('prev', prevDisabled)}
        {viewingPly !== null ? (
          <Pressable onPress={() => onSelectPly(null)}>
            <Text className='font-sans-semibold text-sm text-primary'>
              Back to live
            </Text>
          </Pressable>
        ) : (
          <Text className='font-mono-semibold text-[10px] uppercase tracking-[0.5px] text-muted-foreground'>
            Live
          </Text>
        )}
        {chevronButton('next', nextDisabled)}
      </View>
    </CardHeader>
  );

  if (orientation === 'horizontal') {
    return (
      <Card className={cn('w-full max-w-[560px] self-center rounded-2xl', className)}>
        {header}
        <CardContent className='p-0'>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            // .scrollbar-hide (global.css, added by #81) — see
            // ActiveGamesList for the same rationale: a swipeable strip
            // shouldn't show a document scrollbar on web.
            className='scrollbar-hide'
            contentContainerClassName='px-4 pb-3 flex-row items-center gap-3'
          >
            {rows.map((row) => (
              <RowGroup
                key={row.number}
                row={row}
                renderCell={renderCell}
                onLayout={(x) => rowOffsets.current.set(row.number, x)}
              />
            ))}
          </ScrollView>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'w-full max-w-[560px] self-center mt-4 lg:mt-0 lg:w-72 lg:max-w-none lg:self-start rounded-2xl',
        className,
      )}
    >
      {header}
      <CardContent className='p-0'>
        <ScrollView className='max-h-40 lg:max-h-[520px]'>
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

// One "1. e4 e5" group in the horizontal strip. A separate component
// (rather than an inline map body) purely so its onLayout can report the
// row's x-offset within the ScrollView's content back to the parent for
// the active-ply auto-scroll above — RN's LayoutChangeEvent only ever
// gives coordinates relative to the node's own parent, so this has to be
// measured here, at the row itself, not computed from outside.
function RowGroup({
  row,
  renderCell,
  onLayout,
}: {
  row: MoveRow;
  renderCell: (cell: MoveCell | undefined) => React.JSX.Element | null;
  onLayout: (x: number) => void;
}): React.JSX.Element {
  const handleLayout = (event: LayoutChangeEvent): void => {
    onLayout(event.nativeEvent.layout.x);
  };

  return (
    <View className='flex-row items-center gap-1' onLayout={handleLayout}>
      <Text className='font-mono text-[13px] text-faint'>{row.number}.</Text>
      {renderCell(row.white)}
      {renderCell(row.black)}
    </View>
  );
}
