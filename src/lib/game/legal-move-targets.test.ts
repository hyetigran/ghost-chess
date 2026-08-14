import { Chess } from 'chess.js';
import { legalMoveTargets } from '~/lib/game/legal-move-targets';

describe('legalMoveTargets', () => {
  it("excludes a pawn's forward push square when nothing confirms it's actually empty", () => {
    // Nothing here attacks e3 (pawns don't attack their own forward
    // square, and the king is too far away), so neither push is a
    // confident, tappable target.
    const chess = new Chess('7k/8/8/8/8/8/4P3/K7 w - - 0 1');
    const targets = legalMoveTargets(chess, 'e2', 'w');

    expect(targets.has('e3')).toBe(false);
    expect(targets.has('e4')).toBe(false);
  });

  it("includes a pawn's forward push square once another piece's vision confirms it's clear", () => {
    const chess = new Chess('7k/8/8/8/8/R7/4P3/7K w - - 0 1');
    const targets = legalMoveTargets(chess, 'e2', 'w');

    expect(targets.has('e3')).toBe(true);
    // The double push is gated on e3 (the pawn's path's first step), not
    // e4 — confirming e3 is enough, since that's the square the pawn
    // must actually step through.
    expect(targets.has('e4')).toBe(true);
  });

  it('includes a pawn double push from its starting square (the reported bug)', () => {
    // Standard starting position: nothing attacks e4 (a pawn's own attack
    // geometry never covers its forward squares, and no other piece is
    // developed enough this early to reach the 4th rank), but the d2
    // pawn's diagonal attack confirms e3 — the path's first step — is
    // clear, which is all that's needed to offer the double push.
    const chess = new Chess(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    const targets = legalMoveTargets(chess, 'e2', 'w');

    expect(targets.has('e3')).toBe(true);
    expect(targets.has('e4')).toBe(true);
  });

  it("excludes a pawn's forward push square a hidden enemy piece actually occupies (the reported bug)", () => {
    // Real repro shape (reported bug): white pawn on e4 with nothing else on the
    // board to grant vision of e5 — black's e5 pawn is completely hidden.
    // Before this fix, useSquareSelection offered e5 as a tappable
    // target here (this function is what backs it, unlike
    // legal-target-squares.ts's haze rule, which already gated this
    // correctly — see that file's identically-worded test). Tapping it
    // would optimistically move the pawn there, then the server — seeing
    // the real, occupied board — would reject it and silently revert
    // with no explanation.
    const chess = new Chess('4k3/8/8/4p3/4P3/8/8/4K3 w - - 0 1', {
      skipValidation: true,
    });
    const targets = legalMoveTargets(chess, 'e4', 'w');

    expect(targets.has('e5')).toBe(false);
  });

  it("includes a pawn's diagonal squares speculatively, even when genuinely empty", () => {
    const chess = new Chess('7k/8/8/8/4P3/8/8/K7 w - - 0 1');
    const targets = legalMoveTargets(chess, 'e4', 'w');

    expect(targets.has('d5')).toBe(true);
    expect(targets.has('f5')).toBe(true);
  });

  it('includes a king-capture destination (Fog of War abolishes check-safety filtering)', () => {
    const chess = new Chess('k7/8/8/8/8/8/8/R6K w - - 0 1', {
      skipValidation: true,
    });
    const targets = legalMoveTargets(chess, 'a1', 'w');

    expect(targets.has('a8')).toBe(true);
  });

  it('is unaffected for non-pawn pieces', () => {
    const chess = new Chess('7k/8/8/8/p7/8/8/R6K w - - 0 1');
    const targets = legalMoveTargets(chess, 'a1', 'w');

    expect(targets.has('a2')).toBe(true); // open square before the blocker
    expect(targets.has('a4')).toBe(true); // the blocker itself is capturable
    expect(targets.has('a5')).toBe(false); // beyond the blocker
  });

  it('returns an empty set for an empty square', () => {
    const chess = new Chess('7k/8/8/8/8/8/4P3/K7 w - - 0 1');

    expect(legalMoveTargets(chess, 'e4', 'w').size).toBe(0);
  });
});
