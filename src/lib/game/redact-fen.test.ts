import { Chess } from 'chess.js';
import { computeVisibleSquares, redactFen } from '~/lib/game/redact-fen';

// redactFen now constructs a real chess.js Chess instance to compute vision
// (isAttacked), so — unlike the old pure-string-transform version — every
// fixture here must be a complete, valid position (exactly one king per
// side). Fixtures that don't care about vision specifically place both
// kings far apart (e.g. a1/h8) so they never attack anything else on the
// board and the assertions stay focused on whatever they're actually
// testing.
describe('redactFen', () => {
  it('hides every opponent piece and keeps every own piece at the start position', () => {
    // At the start position no piece attacks any square past its own side's
    // ranks — vision reveals nothing yet, same outcome as the old
    // unconditional-hide model.
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    expect(redactFen(startFen, 'white')).toBe(
      '8/8/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1',
    );
    expect(redactFen(startFen, 'black')).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/8/8 w kq - 0 1',
    );
  });

  it('keeps own pieces visible on an otherwise-hidden rank', () => {
    // 1. e4 - white pawn advanced to e4, still attacks nothing black-owned.
    const afterE4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

    expect(redactFen(afterE4, 'white')).toBe(
      '8/8/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQ - 0 1',
    );
  });

  it('hides an opponent piece and merges the surrounding empty squares', () => {
    const black = redactFen(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      'black',
    );

    expect(black).toBe('rnbqkbnr/pppppppp/8/8/8/8/8/8 b kq - 0 1');
  });

  it('collapses two separate own-piece runs around a hidden opponent piece', () => {
    // White knight, black knight, white knight, 5 empty squares, on an
    // otherwise empty board. Knights (unlike rooks) never attack the
    // square immediately next to them, so the flanking white knights don't
    // give away the black one sitting directly between them — keeps this
    // test focused on the run-collapsing logic, not vision. (A pawn can't
    // legally sit on the back rank, hence knights rather than the
    // original piece choice.)
    const fen = 'NnN5/8/8/8/8/8/8/K6k w - - 0 1';

    expect(redactFen(fen, 'white')).toBe('N1N5/8/8/8/8/8/8/K7 w - - 0 1');
  });

  it('drops the opponent half of castling rights (no incidental vision between the back-rank rooks)', () => {
    // Pawns block every file between the two back-rank rook pairs, so
    // neither side's rooks see the other's — isolates this test to
    // castling-rights redaction, same intent as before the vision rewrite.
    const fen = 'r3k2r/p6p/8/8/8/8/P6P/R3K2R w KQkq - 0 1';

    expect(redactFen(fen, 'white')).toBe(
      '8/8/8/8/8/8/P6P/R3K2R w KQ - 0 1',
    );
    expect(redactFen(fen, 'black')).toBe(
      'r3k2r/p6p/8/8/8/8/8/8 w kq - 0 1',
    );
  });

  it('always hides the en passant target square, regardless of viewer', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';

    expect(redactFen(fen, 'white')).not.toContain('d6');
    expect(redactFen(fen, 'black')).not.toContain('d6');
  });

  it('hides the en passant target square even when the double-pushed pawn itself is now visible', () => {
    // A white rook on the open d-file sees straight through to the black
    // pawn on d5 (the pawn that just double-pushed past d6) — the pawn
    // itself is genuinely visible under Fog of War vision, but the en
    // passant target square (d6) must stay hidden regardless, since it's a
    // distinct piece of information (which of *this viewer's own* pawns
    // has a legal ep capture available right now), not merely "is there a
    // pawn nearby."
    const fen = 'k7/8/8/3pP3/8/8/8/3R3K w - d6 0 3';

    const redacted = redactFen(fen, 'white');
    expect(redacted).toBe('8/8/8/3pP3/8/8/8/3R3K w - - 0 3');
    expect(redacted).not.toContain('d6');
  });

  it('throws on a true fen missing a king — including a genuinely post-king-capture position, not just a malformed one (regression)', () => {
    // ADR-0009: a king capture is a legal move, so a "true" fen can now
    // structurally lack a king for a real, non-error reason — the king
    // was actually captured, not hidden. redactFen's contract is still
    // "trueFen is a complete position with both kings" (it has no
    // skipValidation, unlike chessFromRedactedFen), so this must keep
    // throwing rather than silently redacting a missing king — the fix
    // for a post-capture caller belongs at the call site (check the game
    // is over and skip redaction entirely, matching ADR-0003's reveal-
    // on-completion — see local-game.tsx/use-ai-game.ts), not by
    // weakening this validation. This test exists because that exact
    // contract violation reached production once already (useAiGame
    // called redactFen unconditionally, before checking game-over,
    // throwing "Invalid FEN: missing black king" mid-render).
    const postKingCaptureFen = '4Q3/8/8/8/8/8/8/4K3 b - - 0 1';

    expect(() => redactFen(postKingCaptureFen, 'white')).toThrow();
  });

  it('passes through active color and fullmove number unchanged', () => {
    const fen = '7k/8/8/8/8/8/8/K7 b - - 12 34';

    expect(redactFen(fen, 'white')).toBe('8/8/8/8/8/8/8/K7 b - - 0 34');
  });

  it('always redacts the halfmove clock to 0, regardless of the true value', () => {
    // A nonzero halfmove clock means someone's last move was a pawn move
    // or capture — possibly on a square outside the viewer's vision;
    // passing it through would let a viewer detect that hidden activity
    // just by watching the clock reset.
    const fen = '7k/8/8/8/8/8/8/K7 w - - 7 10';

    expect(redactFen(fen, 'white')).toBe('8/8/8/8/8/8/8/K7 w - - 0 10');
  });

  it('renders a board with no castling rights as an all-dash castling field', () => {
    const fen = '7k/8/8/8/8/8/8/K7 w - - 0 1';

    expect(redactFen(fen, 'white')).toBe('8/8/8/8/8/8/8/K7 w - - 0 1');
  });

  it('rejects a viewer color that is neither white nor black', () => {
    const fen = '7k/8/8/8/8/8/8/K7 w - - 0 1';

    // @ts-expect-error - deliberately invalid input
    expect(() => redactFen(fen, 'red')).toThrow();
  });

  it('rejects a FEN that does not have exactly 6 space-separated fields', () => {
    expect(() => redactFen('8/8/8/8/8/8/8/8 w - -', 'white')).toThrow();
    expect(() =>
      redactFen('8/8/8/8/8/8/8/8 w - - 0 1 extra', 'white'),
    ).toThrow();
  });

  describe('Fog of War vision (ADR-0008)', () => {
    it('reveals an enemy piece on an open file, up to and including the first blocker', () => {
      // White rook a1 slides the whole open a-file up to the black rook on
      // a8 (the first, and only, blocker) — visible. The black king on h8
      // is untouched by anything white has and stays hidden.
      const fen = 'r6k/8/8/8/8/8/8/R6K w - - 0 1';

      expect(redactFen(fen, 'white')).toBe('r7/8/8/8/8/8/8/R6K w - - 0 1');
    });

    it('does not reveal anything beyond the first blocker on a ray', () => {
      // White rook a1's ray up the a-file is blocked by its OWN pawn on
      // a2 — the black pawn on a7 and black rook on a8 behind it stay
      // completely hidden, same as full occlusion would show.
      const fen = 'r6k/p7/8/8/8/8/P7/R6K w - - 0 1';

      expect(redactFen(fen, 'white')).toBe('8/8/8/8/8/8/P7/R6K w - - 0 1');
    });

    it('reveals a pawn only via its diagonal capture squares, never its forward push square', () => {
      // White pawn e4 attacks d5 and f5 (diagonals), never e5 (straight
      // ahead) — the black pawn sitting on d5 is visible, the one on e5
      // (directly ahead, not a capture square) is not.
      const fen = '7k/8/8/3pp3/4P3/8/8/K7 w - - 0 1';

      expect(redactFen(fen, 'white')).toBe(
        '8/8/8/3p4/4P3/8/8/K7 w - - 0 1',
      );
    });

    it('reveals a piece on a knight-reachable square and hides one that is not', () => {
      // White knight d4 attacks b5 (a real L-shape) but not d5 (a straight
      // one-square hop, not a knight move).
      const fen = '7k/8/8/1p1p4/3N4/8/8/K7 w - - 0 1';

      expect(redactFen(fen, 'white')).toBe('8/8/8/1p6/3N4/8/8/K7 w - - 0 1');
    });

    it("reveals a piece adjacent to the viewer's king and hides one two squares away", () => {
      const fen = 'k7/8/4p3/4p3/4K3/8/8/8 w - - 0 1';

      expect(redactFen(fen, 'white')).toBe(
        '8/8/8/4p3/4K3/8/8/8 w - - 0 1',
      );
    });
  });

  describe('computeVisibleSquares', () => {
    it('includes every square the viewer attacks, not just enemy-occupied ones (for the board fog tint)', () => {
      // Same open-file fixture as the redactFen test above: white rook a1
      // attacks the whole a-file up to and including a8 (occupied), so
      // every square in between should be visible too, even though
      // they're empty — the fog tint needs "can I see this square" for
      // ALL squares, not just ones currently hiding a piece.
      const chess = new Chess('r6k/8/8/8/8/8/8/R6K w - - 0 1');
      const visible = computeVisibleSquares(chess, 'white');

      expect(visible.has('a2')).toBe(true);
      expect(visible.has('a5')).toBe(true);
      expect(visible.has('a8')).toBe(true);
      // b-file and beyond are untouched by anything white has here.
      expect(visible.has('b5')).toBe(false);
    });

    it('is safe to call directly on a redacted fen and reproduces the same set the server would compute from the true board', () => {
      // The whole point of this function (see its doc comment): a piece
      // that's the first blocker on one of the viewer's own rays is
      // always already revealed in a redacted view, so recomputing
      // vision from that same redacted board reproduces the true-board
      // answer exactly.
      const trueFen = 'r6k/8/8/8/8/8/8/R6K w - - 0 1';
      const redacted = redactFen(trueFen, 'white');

      const fromTrueBoard = computeVisibleSquares(
        new Chess(trueFen),
        'white',
      );
      const fromRedactedBoard = computeVisibleSquares(
        new Chess(redacted, { skipValidation: true }),
        'white',
      );

      expect(fromRedactedBoard).toEqual(fromTrueBoard);
    });
  });
});
