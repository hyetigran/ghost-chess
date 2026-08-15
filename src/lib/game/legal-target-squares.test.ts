import { Chess, type Square } from 'chess.js';
import { legalTargetSquares } from '~/lib/game/legal-target-squares';
import { redactFen } from '~/lib/game/redact-fen';
import { chessFromRedactedFen } from '~/lib/game/redacted-chess';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Reproduces ChessBoard's own `isHazy` predicate (chess-board.tsx) exactly
 * — piece?.color !== ownColor && !reachable.has(square) — over every
 * square, for a viewer looking at their own redacted view of `trueFen`.
 * Goes through the real redactFen → chessFromRedactedFen → legalTargetSquares
 * pipeline a live board actually uses, not just legalTargetSquares in
 * isolation, so a regression in redaction or the off-turn query-clone (both
 * upstream of legalTargetSquares) would show up here too, not just a
 * regression in the gating logic itself.
 */
function hazyRanksAtOpening(viewer: 'white' | 'black'): number[] {
  const ownColor = viewer === 'white' ? 'w' : 'b';
  const chess = chessFromRedactedFen(redactFen(START_FEN, viewer));
  const reachable = legalTargetSquares(chess, ownColor);

  const foggyRanks = new Set<number>();
  for (const file of 'abcdefgh') {
    for (let rank = 1; rank <= 8; rank++) {
      const square = `${file}${rank}` as Square;
      const piece = chess.get(square);
      const isHazy = piece?.color !== ownColor && !reachable.has(square);
      if (isHazy) foggyRanks.add(rank);
    }
  }
  return [...foggyRanks].sort((a, b) => a - b);
}

describe('legalTargetSquares', () => {
  it("excludes a pawn's forward push square when nothing confirms it's actually empty", () => {
    // Unlike a diagonal capture attempt (harmless if wrong), a straight
    // push is only ever offered here because the board *looks* clear —
    // indistinguishable from a hidden enemy piece silently blocking it,
    // so it's not treated as a confident target unless some piece's
    // vision actually confirms the square is clear. Nothing here attacks
    // e3 (pawns don't attack their own forward square, and the king is
    // too far away), so neither push is offered.
    const chess = new Chess('7k/8/8/8/8/8/4P3/K7 w - - 0 1');
    const targets = legalTargetSquares(chess, 'w');

    expect(targets.has('e3')).toBe(false);
    expect(targets.has('e4')).toBe(false);
  });

  it("includes a pawn's forward push square once another piece's vision confirms it's clear", () => {
    // The rook on a3 attacks unblocked along rank 3, including e3 — that
    // confirms e3 is genuinely empty, so the pawn's single push there is
    // a confident target. The double push is gated on that same e3
    // square (the pawn's path's first step to walk through), not the far
    // e4 square, so it's confirmed too.
    const chess = new Chess('7k/8/8/8/8/R7/4P3/7K w - - 0 1');
    const targets = legalTargetSquares(chess, 'w');

    expect(targets.has('e3')).toBe(true);
    expect(targets.has('e4')).toBe(true);
  });

  it('includes a pawn double push from its starting square (the reported bug)', () => {
    // Standard starting position: nothing attacks e4 this early, but the
    // d2 pawn's diagonal attack confirms e3 — the path's first step — is
    // clear, which is all that's needed to offer the double push.
    const chess = new Chess(START_FEN);
    const targets = legalTargetSquares(chess, 'w');

    expect(targets.has('e3')).toBe(true);
    expect(targets.has('e4')).toBe(true);
  });

  it('includes every file\'s double-push destination at the opening, not just e4 (#78)', () => {
    // The single-file e2/e4 check above happens to work even if some
    // *other* file's near-square vision is broken — every pawn but the
    // rook-file ones is covered by a neighboring pawn's diagonal, and
    // the a/h-file pawns are covered only by the b1/g1 knight's jump
    // (a2's near square a3 has no pawn covering it — only Nb1). A bug
    // that broke just the knight-covered corners, or any other single
    // file, would slip past a test that only ever checked the middle of
    // the board. Every file needs its own assertion.
    const chess = new Chess(START_FEN);
    const targets = legalTargetSquares(chess, 'w');

    for (const file of 'abcdefgh') {
      expect(targets.has(`${file}3` as Square)).toBe(true);
      expect(targets.has(`${file}4` as Square)).toBe(true);
    }
  });

  it('includes every file\'s double-push destination at the opening for black too (#78)', () => {
    // Black to move never actually happens at the true opening (white
    // moves first) — this queries black's reach on the *unmoved* board
    // anyway, the same way ChessBoard always shows a player their own
    // reach regardless of whose turn it is. Exercises the off-turn
    // query-clone path (queryChess in legalTargetSquares) across the
    // whole board, not just legalTargetSquares' own single-square
    // off-turn fixture.
    const chess = new Chess(START_FEN);
    const targets = legalTargetSquares(chess, 'b');

    for (const file of 'abcdefgh') {
      expect(targets.has(`${file}6` as Square)).toBe(true);
      expect(targets.has(`${file}5` as Square)).toBe(true);
    }
  });

  it("excludes a pawn's forward push square a hidden enemy piece actually occupies", () => {
    // Mirrors the real bug report: from black's perspective, d5 shows as
    // blank (a white pawn sitting there is outside black's vision — vision
    // never covers a square only via someone else's forward push), so
    // black's d6 pawn's straight push to d5 must not read as a confident,
    // unfogged target even though chess.js — working off this same blank-
    // looking board — is happy to generate the move.
    const chess = new Chess('7k/8/3p4/8/8/8/8/K6R b - - 0 1');
    const targets = legalTargetSquares(chess, 'b');

    expect(targets.has('d5')).toBe(false);
  });

  it("includes a pawn's diagonal squares speculatively, even when genuinely empty", () => {
    // Mirrors pawn-capture-candidates.test.ts's fixture: nothing is
    // actually on d5, but it's still offered — the whole point of the
    // speculative widening this composes with.
    const chess = new Chess('7k/8/8/8/4P3/8/8/K7 w - - 0 1');
    const targets = legalTargetSquares(chess, 'w');

    expect(targets.has('d5')).toBe(true);
    expect(targets.has('f5')).toBe(true);
  });

  it("includes a sliding piece's open-ray squares up to and including a blocker, excludes anything beyond it", () => {
    const chess = new Chess('7k/8/8/8/p7/8/8/R6K w - - 0 1');
    const targets = legalTargetSquares(chess, 'w');

    expect(targets.has('a2')).toBe(true); // open square before the blocker
    expect(targets.has('a3')).toBe(true); // open square before the blocker
    expect(targets.has('a4')).toBe(true); // the blocker itself is capturable
    expect(targets.has('a5')).toBe(false); // beyond the blocker
  });

  it('excludes a square nothing can reach', () => {
    const chess = new Chess('7k/8/8/8/8/8/8/K6R w - - 0 1');
    const targets = legalTargetSquares(chess, 'w');

    expect(targets.has('d4')).toBe(false);
  });

  it("excludes squares occupied by the mover's own pieces", () => {
    const chess = new Chess('7k/8/8/8/8/8/PP6/K7 w - - 0 1');
    const targets = legalTargetSquares(chess, 'w');

    // b2 holds a white pawn — a2's own moves never target it, and pieces
    // never generate a move onto their own square either.
    expect(targets.has('b2')).toBe(false);
    expect(targets.has('a2')).toBe(false);
  });

  it('includes a king-capture destination when one of the mover\'s pieces can reach the enemy king', () => {
    const chess = new Chess('k7/8/8/8/8/8/8/R6K w - - 0 1', {
      skipValidation: true,
    });
    const targets = legalTargetSquares(chess, 'w');

    expect(targets.has('a8')).toBe(true);
  });

  it('unions targets across every one of the mover\'s pieces, not just one', () => {
    const chess = new Chess('7k/8/8/8/8/8/8/RN5K w - - 0 1');
    const targets = legalTargetSquares(chess, 'w');

    expect(targets.has('a8')).toBe(true); // rook's open file
    expect(targets.has('c3')).toBe(true); // knight's jump
  });

  // chess.js's move generator only ever produces moves for chess.turn()
  // — every fixture above happens to ask for that same color, so none of
  // them would catch querying the *other* side's reach. This is the
  // whole point of the fog/haze rule: a player needs to see what their
  // own pieces can reach regardless of whose turn it currently is, not
  // just while it's their own turn.
  it("still reports the mover's reach while it's the opponent's turn to move", () => {
    const chess = new Chess('7k/8/8/8/p7/8/8/R6K b - - 0 1');
    const targets = legalTargetSquares(chess, 'w');

    expect(targets.has('a2')).toBe(true);
    expect(targets.has('a3')).toBe(true);
    expect(targets.has('a4')).toBe(true); // the blocker itself is capturable
    expect(targets.has('a5')).toBe(false); // beyond the blocker
  });

  it("does not mutate the caller's Chess instance when querying off-turn", () => {
    const chess = new Chess('7k/8/8/8/8/8/8/RN5K b - - 0 1');
    legalTargetSquares(chess, 'w');

    expect(chess.turn()).toBe('b');
  });

  // ChessBoard's own haze rule (#78's actual bug report): a square is
  // hazy iff it's not the viewer's own piece and not in this set. At the
  // true opening — before either side has moved — exactly 4 ranks should
  // read as hazy: the opponent's whole half. Own pieces (ranks 1-2) are
  // never hazy regardless of `reachable`; rank 3 (pawn diagonals, knight
  // landings, every pawn's push-path first step) and rank 4 (the
  // corresponding double-push destinations, gated on that same rank-3
  // vision per the header comment) both come back through
  // `legalTargetSquares` and so read as clear too. Runs the real
  // redactFen → chessFromRedactedFen → legalTargetSquares pipeline
  // (hazyRanksAtOpening, above) rather than legalTargetSquares alone, so
  // it also catches a regression in redaction or the off-turn clone, not
  // only in the gating predicate itself.
  it('fogs exactly 4 ranks at the opening for white (#78)', () => {
    expect(hazyRanksAtOpening('white')).toEqual([5, 6, 7, 8]);
  });

  it('fogs exactly 4 ranks at the opening for black (#78)', () => {
    expect(hazyRanksAtOpening('black')).toEqual([1, 2, 3, 4]);
  });

  it("does not unfog a whole file once a pawn's used its first move (#78 task 4)", () => {
    // Once e2's pawn has stepped to e3, its only remaining forward move
    // is the single push e3-e4 — the double-push option is gone (it's no
    // longer on its start rank), so e4 is no longer implicitly confirmed
    // by e3's own vision the way it was pre-move. Nothing yet attacks e4
    // (no piece develops to cover it in one ply), so e4 must still read
    // as hazy — the fix for #78 must not overcorrect into treating an
    // entire file as permanently unfogged once its pawn has moved once.
    const chess = new Chess();
    chess.move('e3');
    chess.move('e6'); // mirror, so it's white to move again — same viewer as before
    const targets = legalTargetSquares(chess, 'w');

    expect(targets.has('e4')).toBe(false);
  });
});
