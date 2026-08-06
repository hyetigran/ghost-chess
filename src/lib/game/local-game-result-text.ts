import type { Color, LocalGameResult } from '~/lib/game/local-move';

export function describeLocalGameResult(
  result: LocalGameResult,
  winner: Color | null,
): string {
  switch (result) {
    case 'king_captured':
      return `${winner === 'white' ? 'White' : 'Black'} wins by capturing the king!`;
    case 'draw':
      return 'Draw.';
  }
}
