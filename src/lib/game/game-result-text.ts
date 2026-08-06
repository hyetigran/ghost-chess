import type { GameResult } from '~/types/database';

// Human-readable post-game result text, phrased relative to the viewer
// (#19's "post-game summary" — result). Pure and unit-tested so the
// win/loss/draw phrasing logic doesn't live tangled in JSX.
export function describeGameResult(
  result: GameResult,
  winnerId: string | null,
  viewerId: string | undefined,
): string {
  if (!result) return 'Game over.';
  if (!viewerId) {
    const generic: Record<Exclude<GameResult, null>, string> = {
      king_captured: 'Game over — a king was captured.',
      draw: 'Game over — draw.',
      abandoned: 'Game over — a player resigned.',
      timeout: 'Game over — a player ran out of time.',
    };
    return generic[result];
  }

  const won = winnerId === viewerId;

  switch (result) {
    case 'king_captured':
      return won
        ? 'You won by capturing the king!'
        : 'You lost — your king was captured.';
    case 'timeout':
      return won
        ? 'You won — your opponent ran out of time!'
        : 'You lost — you ran out of time.';
    case 'abandoned':
      return won ? 'You won — your opponent resigned!' : 'You resigned.';
    case 'draw':
      return 'Draw.';
  }
}
