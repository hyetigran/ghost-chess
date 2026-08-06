import { describeLocalGameResult } from '~/lib/game/local-game-result-text';

describe('describeLocalGameResult', () => {
  it('names the winning side on king capture', () => {
    expect(describeLocalGameResult('king_captured', 'white')).toBe(
      'White wins by capturing the king!',
    );
    expect(describeLocalGameResult('king_captured', 'black')).toBe(
      'Black wins by capturing the king!',
    );
  });

  it('describes a plain draw', () => {
    expect(describeLocalGameResult('draw', null)).toBe('Draw.');
  });
});
