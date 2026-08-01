import type { Color, LocalGameResult } from '~/lib/game/local-move';

export function describeLocalGameResult(
  result: LocalGameResult,
  winner: Color | null,
): string {
  switch (result) {
    case 'checkmate':
      return `${winner === 'white' ? 'White' : 'Black'} wins by checkmate!`;
    case 'stalemate':
      return 'Draw by stalemate.';
    case 'draw':
      return 'Draw.';
  }
}
