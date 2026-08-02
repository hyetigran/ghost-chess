import { findCapturedOwnSquare } from '~/lib/game/capture-square';

describe('findCapturedOwnSquare', () => {
  it('finds the square where an own piece vanished between two FENs', () => {
    // White's pawn on e4 is gone in the new FEN — black just captured it.
    const previous =
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const next = 'rnbqkbnr/pppp1ppp/8/8/4p3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3';

    expect(findCapturedOwnSquare(previous, next, 'w')).toBe('e4');
  });

  it("returns null when nothing of the viewer's own color vanished", () => {
    // Same position, nothing changed.
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(findCapturedOwnSquare(fen, fen, 'w')).toBeNull();
  });

  it('ignores opponent pieces vanishing (occlusion means the viewer never sees those anyway)', () => {
    // Both FENs are from white's own redacted view — no black pieces are
    // ever present to "vanish" in the first place.
    const previous = '8/8/8/8/4P3/8/8/RNBQKBNR w KQkq - 0 1';
    const next = '8/8/8/8/8/8/8/RNBQKBNR w KQkq - 0 1';

    // White's own e4 pawn vanished — that's a real own-piece loss.
    expect(findCapturedOwnSquare(previous, next, 'w')).toBe('e4');
    // From black's perspective, checking for black pieces, there's
    // nothing to find in either fen.
    expect(findCapturedOwnSquare(previous, next, 'b')).toBeNull();
  });

  it('finds the first vanished own square when checked for black', () => {
    const previous =
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';
    const next = 'rnbqkbnr/pppp1ppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3';

    expect(findCapturedOwnSquare(previous, next, 'b')).toBe('e5');
  });
});
