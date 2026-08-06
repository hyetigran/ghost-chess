import type { GameOutcomeTone } from '~/lib/game/game-result-text';
import type { Color, LocalGameResult } from '~/lib/game/local-move';

// Only meaningful for the AI screen, where humanColor gives a real "you"
// to be positive/negative about — local pass-and-play has no single
// viewer once the game ends (both players shared the device), so that
// screen always renders the banner with tone 'neutral' instead of calling
// this.
export function localGameOutcomeTone(
  result: LocalGameResult,
  winner: Color | null,
  viewerColor: Color,
): GameOutcomeTone {
  if (result === 'draw') return 'neutral';
  return winner === viewerColor ? 'positive' : 'negative';
}

export function localGameOutcomeHeading(
  result: LocalGameResult,
  winner: Color | null,
  viewerColor: Color,
): string {
  if (result === 'draw') return 'Draw';
  return winner === viewerColor ? 'You Won' : 'You Lost';
}

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
