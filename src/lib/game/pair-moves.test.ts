import { pairMoves } from '~/lib/game/pair-moves';

describe('pairMoves', () => {
  it('pairs white/black moves into numbered rows', () => {
    const rows = pairMoves([
      { san: 'e4', color: 'white' },
      { san: 'e5', color: 'black' },
      { san: 'Nf3', color: 'white' },
      { san: 'Nc6', color: 'black' },
    ]);

    expect(rows).toEqual([
      { number: 1, white: 'e4', black: 'e5' },
      { number: 2, white: 'Nf3', black: 'Nc6' },
    ]);
  });

  it('leaves the last row missing black when white just moved', () => {
    const rows = pairMoves([
      { san: 'e4', color: 'white' },
      { san: 'e5', color: 'black' },
      { san: 'Nf3', color: 'white' },
    ]);

    expect(rows).toEqual([
      { number: 1, white: 'e4', black: 'e5' },
      { number: 2, white: 'Nf3' },
    ]);
  });

  it('returns an empty list for no moves', () => {
    expect(pairMoves([])).toEqual([]);
  });

  it('opens a black-only row when the sequence starts on black', () => {
    const rows = pairMoves([{ san: 'e5', color: 'black' }]);

    expect(rows).toEqual([{ number: 1, black: 'e5' }]);
  });
});
