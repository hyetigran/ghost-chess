import { Chess } from 'chess.js';
import { pawnCaptureCandidates } from '~/lib/game/pawn-capture-candidates';

describe('pawnCaptureCandidates', () => {
  it('offers both diagonal squares for a white pawn with nothing visible there', () => {
    // Redacted view: the diagonal squares look empty (an opponent piece
    // may actually be there, invisible to this viewer).
    const chess = new Chess(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
      { skipValidation: true },
    );
    expect(new Set(pawnCaptureCandidates(chess, 'e4', 'w'))).toEqual(
      new Set(['d5', 'f5']),
    );
  });

  it('offers both diagonal squares for a black pawn', () => {
    const chess = new Chess(
      'rnbqkbnr/ppp1pppp/8/3p4/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
      { skipValidation: true },
    );
    expect(new Set(pawnCaptureCandidates(chess, 'd5', 'b'))).toEqual(
      new Set(['c4', 'e4']),
    );
  });

  it("excludes a diagonal square occupied by the viewer's own piece", () => {
    const chess = new Chess(
      'rnbqkbnr/pppppppp/8/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 1',
      { skipValidation: true },
    );
    // d4 and e4 are both white pawns — e4 attacking diagonally to d5/f5,
    // but if it were attacking its own d4 that would be excluded. Use a
    // same-rank adjacent own-pawn scenario instead:
    const chess2 = new Chess('8/8/8/8/3P1P2/4P3/8/8 w - - 0 1', {
      skipValidation: true,
    });
    // e3 pawn's diagonals are d4 and f4 — both occupied by white's own
    // pawns, so neither should be offered.
    expect(pawnCaptureCandidates(chess2, 'e3', 'w')).toEqual([]);
  });

  it('excludes diagonal squares off the edge of the board', () => {
    const chess = new Chess('8/8/8/8/8/8/P7/8 w - - 0 1', {
      skipValidation: true,
    });
    // a2 pawn's only diagonal on the board is b3 (a-file has no square
    // to the left).
    expect(pawnCaptureCandidates(chess, 'a2', 'w')).toEqual(['b3']);
  });

  it('returns an empty array for a non-pawn piece', () => {
    const chess = new Chess();
    expect(pawnCaptureCandidates(chess, 'b1', 'w')).toEqual([]);
  });
});
