import { findKingSquares } from '~/lib/game/king-squares';

// Feeds findKingSquares real post-game positions specifically — the
// caller-side contract (ChessBoard's `resultWinner` prop doc) is that
// this only ever runs once ADR-0003's reveal-on-completion has lifted
// occlusion, so every fixture here is a true, fully-revealed FEN, never
// a redacted one.
describe('findKingSquares', () => {
  it('finds both kings on a normal (drawn or in-progress) position', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    expect(findKingSquares(fen)).toEqual({ white: 'e1', black: 'e8' });
  });

  it("reports the captured side's king as null once king-capture has actually removed it (ADR-0009)", () => {
    // White just captured the black king outright — the true post-game
    // fen has no black king on it at all, unlike ordinary chess where
    // that position could never be reached.
    const fen = '8/8/8/8/8/8/8/K7 w - - 0 1';

    expect(findKingSquares(fen)).toEqual({ white: 'a1', black: null });
  });

  it('finds a king on any square, not just its starting one', () => {
    const fen = '8/8/4k3/8/8/3K4/8/8 w - - 0 1';

    expect(findKingSquares(fen)).toEqual({ white: 'd3', black: 'e6' });
  });
});
