import { describeLocalGameResult } from '~/lib/game/local-game-result-text';

describe('describeLocalGameResult', () => {
  it('names the winning side on checkmate', () => {
    expect(describeLocalGameResult('checkmate', 'white')).toBe(
      'White wins by checkmate!',
    );
    expect(describeLocalGameResult('checkmate', 'black')).toBe(
      'Black wins by checkmate!',
    );
  });

  it('describes stalemate as a draw with no winner', () => {
    expect(describeLocalGameResult('stalemate', null)).toBe(
      'Draw by stalemate.',
    );
  });

  it('describes a plain draw', () => {
    expect(describeLocalGameResult('draw', null)).toBe('Draw.');
  });
});
