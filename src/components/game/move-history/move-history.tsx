import * as React from 'react';
import { ScrollView, View } from 'react-native';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
} from '~/components/ui';
import { pairMoves, type MoveEntry } from '~/lib/game/pair-moves';

type Props = {
  moves: MoveEntry[];
};

// Below the board on narrow screens (w-full max-w-[560px] self-center,
// matching ChessBoard's own sizing), a fixed-width sidebar to the board's
// right from the lg breakpoint up — the standard board+move-list layout.
// The row list itself scrolls within a capped height rather than growing
// unbounded (taller on lg, since it sits beside the ~560px board rather
// than below it); auto-scrolls to the newest move as one is added.
export function MoveHistory({ moves }: Props): React.JSX.Element | null {
  const scrollRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [moves.length]);

  if (moves.length === 0) return null;

  const rows = pairMoves(moves);

  return (
    <Card className='w-full max-w-[560px] self-center mt-4 lg:mt-0 lg:w-72 lg:max-w-none lg:self-start rounded-2xl'>
      <CardHeader className='py-3'>
        <CardTitle className='text-base'>Moves</CardTitle>
      </CardHeader>
      <CardContent className='p-0'>
        <ScrollView ref={scrollRef} className='max-h-40 lg:max-h-[520px]'>
          <View className='px-4 pb-3'>
            {rows.map((row) => (
              <View key={row.number} className='flex-row py-1'>
                <Text className='w-8 text-muted-foreground'>
                  {row.number}.
                </Text>
                <Text className='flex-1'>{row.white ?? ''}</Text>
                <Text className='flex-1'>{row.black ?? ''}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </CardContent>
    </Card>
  );
}
