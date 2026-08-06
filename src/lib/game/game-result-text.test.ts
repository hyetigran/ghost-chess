import {
  describeGameResult,
  gameOutcomeHeading,
  gameOutcomeTone,
} from '~/lib/game/game-result-text';

const VIEWER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OPPONENT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('describeGameResult', () => {
  it('describes a king-capture win for the viewer', () => {
    expect(describeGameResult('king_captured', VIEWER, VIEWER)).toBe(
      'You won by capturing the king!',
    );
  });

  it('describes a king-capture loss for the viewer', () => {
    expect(describeGameResult('king_captured', OPPONENT, VIEWER)).toBe(
      'You lost — your king was captured.',
    );
  });

  it('describes a timeout win and loss', () => {
    expect(describeGameResult('timeout', VIEWER, VIEWER)).toBe(
      'You won — your opponent ran out of time!',
    );
    expect(describeGameResult('timeout', OPPONENT, VIEWER)).toBe(
      'You lost — you ran out of time.',
    );
  });

  it('describes a resignation win and loss', () => {
    expect(describeGameResult('abandoned', VIEWER, VIEWER)).toBe(
      'You won — your opponent resigned!',
    );
    expect(describeGameResult('abandoned', OPPONENT, VIEWER)).toBe(
      'You resigned.',
    );
  });

  it('describes a draw as neutral, regardless of winnerId', () => {
    expect(describeGameResult('draw', null, VIEWER)).toBe('Draw.');
  });

  it('falls back to a generic message when the result is null', () => {
    expect(describeGameResult(null, null, VIEWER)).toBe('Game over.');
  });

  it('falls back to a generic message when the viewer id is unknown', () => {
    expect(describeGameResult('king_captured', VIEWER, undefined)).toBe(
      'Game over — a king was captured.',
    );
  });
});

describe('gameOutcomeTone', () => {
  it('is positive when the viewer won', () => {
    expect(gameOutcomeTone('king_captured', VIEWER, VIEWER)).toBe('positive');
  });

  it('is negative when the viewer lost', () => {
    expect(gameOutcomeTone('king_captured', OPPONENT, VIEWER)).toBe(
      'negative',
    );
  });

  it('is neutral for a draw, regardless of winnerId', () => {
    expect(gameOutcomeTone('draw', null, VIEWER)).toBe('neutral');
  });

  it('is neutral when the result or viewer is unknown', () => {
    expect(gameOutcomeTone(null, null, VIEWER)).toBe('neutral');
    expect(gameOutcomeTone('king_captured', VIEWER, undefined)).toBe(
      'neutral',
    );
  });
});

describe('gameOutcomeHeading', () => {
  it('reads "You Won" / "You Lost" for the viewer', () => {
    expect(gameOutcomeHeading('king_captured', VIEWER, VIEWER)).toBe(
      'You Won',
    );
    expect(gameOutcomeHeading('king_captured', OPPONENT, VIEWER)).toBe(
      'You Lost',
    );
  });

  it('reads "Draw" for a draw', () => {
    expect(gameOutcomeHeading('draw', null, VIEWER)).toBe('Draw');
  });

  it('falls back to "Game Over" when the result or viewer is unknown', () => {
    expect(gameOutcomeHeading(null, null, VIEWER)).toBe('Game Over');
    expect(gameOutcomeHeading('king_captured', VIEWER, undefined)).toBe(
      'Game Over',
    );
  });
});
