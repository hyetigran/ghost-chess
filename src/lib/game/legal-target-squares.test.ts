import { Chess } from 'chess.js';
import { legalTargetSquares } from '~/lib/game/legal-target-squares';

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
    const chess = new Chess(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    const targets = legalTargetSquares(chess, 'w');

    expect(targets.has('e3')).toBe(true);
    expect(targets.has('e4')).toBe(true);
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
});
