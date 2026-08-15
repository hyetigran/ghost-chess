import { deriveLastMoveSquares } from '~/lib/game/last-move-squares';

// Every fixture here is deliberately fed through the same code path this
// function is actually called with in ChessBoard: two FEN *strings*, with
// no assumption that either is a complete/valid chess.js position (redacted
// FENs never are — chessFromRedactedFen's own comment). Fixtures that
// exercise the fog-safety guarantee use genuinely redacted-looking FENs
// (an opponent piece simply absent, the way redact_fen actually produces
// them) rather than a "hidden" marker of any kind, since that absence is
// the real mechanism the safety argument rests on.
describe('deriveLastMoveSquares', () => {
  it('finds a simple pawn push', () => {
    const before = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const after = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

    expect(deriveLastMoveSquares(before, after)).toEqual({
      from: 'e2',
      to: 'e4',
    });
  });

  it('finds a capture, attributing the destination to the mover not the captured piece', () => {
    // White knight on c3 captures a black pawn sitting on d5.
    const before = '8/8/8/3p4/8/2N5/8/K6k w - - 0 1';
    const after = '8/8/8/3N4/8/8/8/K6k b - - 0 1';

    expect(deriveLastMoveSquares(before, after)).toEqual({
      from: 'c3',
      to: 'd5',
    });
  });

  it('finds a kingside castle as the king-only move, ignoring the rook', () => {
    const before = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const after = 'r3k2r/8/8/8/8/8/8/R4RK1 b kq - 0 1';

    expect(deriveLastMoveSquares(before, after)).toEqual({
      from: 'e1',
      to: 'g1',
    });
  });

  it('finds an en passant capture without confusing the captured pawn for the mover', () => {
    // White pawn on e5, black just pushed d7-d5, white captures en
    // passant landing on d6 and removing the pawn on d5.
    const before = '8/8/8/3pP3/8/8/8/K6k w - d6 0 1';
    const after = '8/8/3P4/8/8/8/8/K6k b - - 0 1';

    expect(deriveLastMoveSquares(before, after)).toEqual({
      from: 'e5',
      to: 'd6',
    });
  });

  it('finds a promotion as one from/to pair despite the piece type changing', () => {
    const before = '8/P7/8/8/8/8/8/K6k w - - 0 1';
    const after = 'Q7/8/8/8/8/8/8/K6k b - - 0 1';

    expect(deriveLastMoveSquares(before, after)).toEqual({
      from: 'a7',
      to: 'a8',
    });
  });

  it('returns null when nothing changed', () => {
    const fen = '8/8/8/8/8/8/8/K6k w - - 0 1';

    expect(deriveLastMoveSquares(fen, fen)).toBeNull();
  });

  it('returns null for a multi-move gap it cannot attribute to a single move', () => {
    const before = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    // Several plies apart, not just one — deliberately not a move pair.
    const after =
      'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

    expect(deriveLastMoveSquares(before, after)).toBeNull();
  });

  // --- Fog-safety fixtures -------------------------------------------
  //
  // These are the cases that matter for CONTEXT.md's Visibility entry:
  // ChessBoard must never highlight a from-square the viewer's redacted
  // FEN never actually showed a piece on. Since a redacted FEN literally
  // omits an invisible opponent piece (redact_fen, ADR-0008) rather than
  // marking it hidden some other way, this function's ordinary "did a
  // square's content change" diff is *automatically* safe here — there's
  // nothing to invent from, because the information was never present in
  // either input string. No separate fog-aware branch is needed; these
  // tests exist to pin that guarantee down explicitly.
  it('omits the from-square when an opponent piece moves out of fog into vision (viewer never saw the origin)', () => {
    // Viewer is white, black is the mover (black to move in "before").
    // The knight's origin square already looks empty in the "before"
    // redacted view (fogged), and it lands somewhere that becomes
    // visible. From white's redacted perspective, nothing ever appeared
    // to leave that square (it already looked empty), so there is no
    // vacated square to report — only an arrival.
    const before = '8/8/8/8/8/8/8/K6k b - - 0 1'; // origin already shows empty
    const after = '8/8/2n5/8/8/8/8/K6k w - - 0 1'; // knight now visible on c6

    expect(deriveLastMoveSquares(before, after)).toBeNull();
  });

  it('omits the from-square when a visible opponent piece moves into fog (destination not shown)', () => {
    // The opponent piece was visible on c6 before (black to move), then
    // moves somewhere outside the viewer's current vision — the redacted
    // "after" FEN simply shows c6 empty and nothing new anywhere, same
    // as if no move had happened at all from this viewer's point of view.
    const before = '8/8/2n5/8/8/8/8/K6k b - - 0 1';
    const after = '8/8/8/8/8/8/8/K6k w - - 0 1';

    expect(deriveLastMoveSquares(before, after)).toBeNull();
  });

  it('shows both squares when an opponent piece was already visible and stays visible after moving', () => {
    const before = '8/8/2n5/8/8/8/8/K6k b - - 0 1';
    const after = '8/3n4/8/8/8/8/8/K6k w - - 0 1';

    expect(deriveLastMoveSquares(before, after)).toEqual({
      from: 'c6',
      to: 'd7',
    });
  });

  it("always shows the viewer's own move in full, own pieces being unconditionally visible", () => {
    const before = '8/8/8/8/8/8/8/K6k w - - 0 1';
    const after = '8/8/8/8/8/1K6/8/7k b - - 0 1';

    expect(deriveLastMoveSquares(before, after)).toEqual({
      from: 'a1',
      to: 'b3',
    });
  });
});
