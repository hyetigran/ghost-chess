import { pairMoves } from '~/lib/game/pair-moves';

const FEN_1 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const FEN_2 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const FEN_3 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
const FEN_4 = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';

describe('pairMoves', () => {
  it('pairs white/black moves into numbered rows', () => {
    const rows = pairMoves([
      { san: 'e4', color: 'white', fen: FEN_1 },
      { san: 'e5', color: 'black', fen: FEN_2 },
      { san: 'Nf3', color: 'white', fen: FEN_3 },
      { san: 'Nc6', color: 'black', fen: FEN_4 },
    ]);

    expect(rows).toEqual([
      {
        number: 1,
        white: { san: 'e4', fen: FEN_1, ply: 0 },
        black: { san: 'e5', fen: FEN_2, ply: 1 },
      },
      {
        number: 2,
        white: { san: 'Nf3', fen: FEN_3, ply: 2 },
        black: { san: 'Nc6', fen: FEN_4, ply: 3 },
      },
    ]);
  });

  it('leaves the last row missing black when white just moved', () => {
    const rows = pairMoves([
      { san: 'e4', color: 'white', fen: FEN_1 },
      { san: 'e5', color: 'black', fen: FEN_2 },
      { san: 'Nf3', color: 'white', fen: FEN_3 },
    ]);

    expect(rows).toEqual([
      {
        number: 1,
        white: { san: 'e4', fen: FEN_1, ply: 0 },
        black: { san: 'e5', fen: FEN_2, ply: 1 },
      },
      { number: 2, white: { san: 'Nf3', fen: FEN_3, ply: 2 } },
    ]);
  });

  it('returns an empty list for no moves', () => {
    expect(pairMoves([])).toEqual([]);
  });

  it('opens a black-only row when the sequence starts on black', () => {
    const rows = pairMoves([{ san: 'e5', color: 'black', fen: FEN_2 }]);

    expect(rows).toEqual([
      { number: 1, black: { san: 'e5', fen: FEN_2, ply: 0 } },
    ]);
  });
});
