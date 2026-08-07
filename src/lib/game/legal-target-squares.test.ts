import { Chess } from 'chess.js';
import { legalTargetSquares } from '~/lib/game/legal-target-squares';

describe('legalTargetSquares', () => {
  it("includes a pawn's forward push square, even though it's not a capture/vision square", () => {
    const chess = new Chess('7k/8/8/8/8/8/4P3/K7 w - - 0 1');
    const targets = legalTargetSquares(chess, 'w');

    expect(targets.has('e3')).toBe(true);
    expect(targets.has('e4')).toBe(true); // starting-rank double push
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
