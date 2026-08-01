import { describeGameResult } from '~/lib/game/game-result-text';

const VIEWER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OPPONENT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('describeGameResult', () => {
  it('describes a checkmate win for the viewer', () => {
    expect(describeGameResult('checkmate', VIEWER, VIEWER)).toBe(
      'You won by checkmate!',
    );
  });

  it('describes a checkmate loss for the viewer', () => {
    expect(describeGameResult('checkmate', OPPONENT, VIEWER)).toBe(
      'You lost by checkmate.',
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

  it('describes a stalemate or draw as neutral, regardless of winnerId', () => {
    expect(describeGameResult('stalemate', null, VIEWER)).toBe(
      'Draw by stalemate.',
    );
    expect(describeGameResult('draw', null, VIEWER)).toBe('Draw.');
  });

  it('falls back to a generic message when the result is null', () => {
    expect(describeGameResult(null, null, VIEWER)).toBe('Game over.');
  });

  it('falls back to a generic message when the viewer id is unknown', () => {
    expect(describeGameResult('checkmate', VIEWER, undefined)).toBe(
      'Game over — checkmate.',
    );
  });
});
