import { Chess, type Square } from 'chess.js';
import {
  applyPseudoLegalMove,
  applyPseudoLegalSan,
  pseudoLegalMoves,
  wasKingCaptured,
} from '~/lib/game/pseudo-legal-moves';

/**
 * Canary test for the verification spike behind Fog of War's move-legality
 * rewrite (ADR-0009). This module relies on three underscore-prefixed,
 * undocumented chess.js internals (`_moves`, `_makeMove`, `_moveToSan`) —
 * real methods at runtime, but not part of chess.js's public contract, so a
 * future version bump could silently rename/remove/change them with no
 * semver warning. If ANY assertion in this file starts failing after a
 * chess.js upgrade: do not just adjust the assertion. Re-derive, by hand,
 * whether the new version still exposes equivalent private surface (read
 * node_modules/chess.js/dist/cjs/chess.js directly, same way this module's
 * behavior was originally verified), before trusting pseudo-legal-moves.ts
 * again — a silent behavioral change here means real games can end with a
 * king wrongly left on the board, or a wrongly-rejected legal move.
 */
describe('pseudo-legal-moves canary: chess.js private surface exists', () => {
  it('exposes _moves, _makeMove, _moveToSan, and _incPositionCount as callable functions', () => {
    const chess = new Chess() as unknown as Record<string, unknown>;
    expect(typeof chess._moves).toBe('function');
    expect(typeof chess._makeMove).toBe('function');
    expect(typeof chess._moveToSan).toBe('function');
    expect(typeof chess._incPositionCount).toBe('function');
  });
});

describe('pseudoLegalMoves / applyPseudoLegalMove', () => {
  it('offers and applies a king-capturing move (impossible via the public chess.js API)', () => {
    // White queen e4 lined up on the black king e8, white to move — can
    // never arise from legal play (black would have had to leave itself in
    // check), so this bypasses chess.js's own load-time FEN validation
    // exactly like this repo's chessFromRedactedFen() already does.
    const chess = new Chess('4k3/8/8/8/4Q3/8/8/K7 w - - 0 1', {
      skipValidation: true,
    });

    const moves = pseudoLegalMoves(chess, { square: 'e4' });
    const kingCapture = moves.find((m) => m.to === 'e8');
    expect(kingCapture).toBeDefined();
    expect(kingCapture?.captured).toBe('k');
    expect(kingCapture?.san).toBe('Qxe8');

    const outcome = applyPseudoLegalMove(chess, { from: 'e4', to: 'e8' });
    expect(outcome).not.toBeNull();
    expect(outcome && wasKingCaptured(outcome)).toBe(true);

    const pieces = chess.board().flat().filter(Boolean);
    expect(pieces.some((p) => p?.type === 'k' && p?.color === 'b')).toBe(
      false,
    );
    expect(pieces.some((p) => p?.type === 'k' && p?.color === 'w')).toBe(
      true,
    );
  });

  it('lets a king capture an adjacent enemy king', () => {
    const chess = new Chess('8/8/8/4k3/4K3/8/8/8 w - - 0 1', {
      skipValidation: true,
    });

    const outcome = applyPseudoLegalMove(chess, { from: 'e4', to: 'e5' });
    expect(outcome).not.toBeNull();
    expect(outcome && wasKingCaptured(outcome)).toBe(true);
    expect(
      chess
        .board()
        .flat()
        .filter(Boolean)
        .some((p) => p?.type === 'k' && p?.color === 'b'),
    ).toBe(false);
  });

  it('bypasses the pin veto: a pinned rook can move off the pin file (leaving its own king exposed)', () => {
    // White rook e4 pinned to white king e1 by black rook e8 along the
    // e-file. Moving the white rook to d4 would leave the king in check
    // under standard rules — chess.js's public, legal-filtered API must
    // still reject it (confirms the fixture is a real pin); the
    // pseudo-legal path must allow it (confirms the veto is bypassed).
    const fen = '4r3/8/8/8/4R3/8/8/4K3 w - - 0 1';

    const legalChess = new Chess(fen, { skipValidation: true });
    const legalMoves = legalChess.moves({ square: 'e4', verbose: true });
    expect(legalMoves.some((m) => m.to === 'd4')).toBe(false);

    const pseudoChess = new Chess(fen, { skipValidation: true });
    const pseudoMoves = pseudoLegalMoves(pseudoChess, { square: 'e4' });
    expect(pseudoMoves.some((m) => m.to === 'd4')).toBe(true);

    const outcome = applyPseudoLegalMove(pseudoChess, {
      from: 'e4',
      to: 'd4',
    });
    expect(outcome).not.toBeNull();
  });

  it('lets a king step into a square attacked by an enemy piece', () => {
    // White king a1; black rook a8 attacks straight down the a-file, so a2
    // is attacked. b1/b2 are not attacked by anything. Under the public,
    // legal-filtered API the king may only go to b1/b2; under pseudo-legal
    // rules a2 must also be offered, since "walking into check" is no
    // longer illegal.
    const fen = 'r6k/8/8/8/8/8/8/K7 w - - 0 1';

    const legalChess = new Chess(fen, { skipValidation: true });
    const legalTargets = legalChess
      .moves({ square: 'a1', verbose: true })
      .map((m) => m.to);
    expect(legalTargets).not.toContain('a2');
    expect(legalTargets).toEqual(expect.arrayContaining(['b1', 'b2']));

    const pseudoChess = new Chess(fen, { skipValidation: true });
    const pseudoTargets = pseudoLegalMoves(pseudoChess, {
      square: 'a1',
    }).map((m) => m.to);
    expect(pseudoTargets).toContain('a2');
  });

  it('returns null for a move that matches no pseudo-legal candidate', () => {
    const chess = new Chess();
    const outcome = applyPseudoLegalMove(chess, { from: 'e2', to: 'e5' });
    expect(outcome).toBeNull();
  });

  it('defaults promotion to queen when omitted, matching the app-wide auto-queen behavior', () => {
    const chess = new Chess('8/P7/8/8/4k3/8/8/4K3 w - - 0 1', {
      skipValidation: true,
    });
    const outcome = applyPseudoLegalMove(chess, { from: 'a7', to: 'a8' });
    expect(outcome?.promotion).toBe('q');
    expect(chess.get('a8')?.type).toBe('q');
  });

  describe('bookkeeping fidelity through _makeMove', () => {
    it('produces the exact same FEN as the public chess.js API for an ordinary (non-check-safety-relevant) game', () => {
      const sanMoves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'];
      const algebraicMoves: { from: Square; to: Square }[] = [
        { from: 'e2', to: 'e4' },
        { from: 'e7', to: 'e5' },
        { from: 'g1', to: 'f3' },
        { from: 'b8', to: 'c6' },
        { from: 'f1', to: 'b5' },
        { from: 'a7', to: 'a6' },
      ];

      const reference = new Chess();
      for (const san of sanMoves) reference.move(san);

      const viaModule = new Chess();
      for (const move of algebraicMoves) {
        const outcome = applyPseudoLegalMove(viaModule, move);
        expect(outcome).not.toBeNull();
      }

      expect(viaModule.fen()).toBe(reference.fen());
    });

    it('keeps threefold-repetition position tracking correct through repeated applyPseudoLegalMove calls', () => {
      const chess = new Chess();
      const shuffle: { from: Square; to: Square }[] = [
        { from: 'g1', to: 'f3' },
        { from: 'g8', to: 'f6' },
        { from: 'f3', to: 'g1' },
        { from: 'f6', to: 'g8' },
        { from: 'g1', to: 'f3' },
        { from: 'g8', to: 'f6' },
        { from: 'f3', to: 'g1' },
        { from: 'f6', to: 'g8' },
      ];

      expect(chess.isThreefoldRepetition()).toBe(false);
      for (const move of shuffle) {
        const outcome = applyPseudoLegalMove(chess, move);
        expect(outcome).not.toBeNull();
      }
      expect(chess.isThreefoldRepetition()).toBe(true);
    });
  });

  describe('applyPseudoLegalSan (move-history replay)', () => {
    it('resolves and applies a stored SAN string, including a king-capturing one', () => {
      const chess = new Chess('4k3/8/8/8/4Q3/8/8/K7 w - - 0 1', {
        skipValidation: true,
      });
      const outcome = applyPseudoLegalSan(chess, 'Qxe8');
      expect(outcome).not.toBeNull();
      expect(outcome && wasKingCaptured(outcome)).toBe(true);
    });

    it('replays an ordinary game identically to the public chess.js API', () => {
      const sanMoves = ['e4', 'e5', 'Nf3', 'Nc6'];
      const reference = new Chess();
      for (const san of sanMoves) reference.move(san);

      const viaModule = new Chess();
      for (const san of sanMoves) {
        expect(applyPseudoLegalSan(viaModule, san)).not.toBeNull();
      }

      expect(viaModule.fen()).toBe(reference.fen());
    });

    it('returns null for a SAN string matching no pseudo-legal move in the position', () => {
      const chess = new Chess();
      expect(applyPseudoLegalSan(chess, 'Qxh8')).toBeNull();
    });
  });

  describe('SAN "+"/"#" stripping', () => {
    it('strips the "#" checkmate suffix chess.js would otherwise append', () => {
      // Fool's mate: chess.js's own _moveToSan would normally append "#" to
      // the final move since, by its (now-obsolete) definition, this
      // position is checkmate — under Fog of War rules the game doesn't
      // end here at all (no king was captured), so a "#" suffix would be
      // actively wrong, not just unused.
      const chess = new Chess();
      const moves: { from: Square; to: Square }[] = [
        { from: 'f2', to: 'f3' },
        { from: 'e7', to: 'e5' },
        { from: 'g2', to: 'g4' },
        { from: 'd8', to: 'h4' },
      ];

      let lastOutcome = null;
      for (const move of moves) {
        lastOutcome = applyPseudoLegalMove(chess, move);
        expect(lastOutcome).not.toBeNull();
      }

      expect(lastOutcome?.san).toBe('Qh4');

      // Confirm the suffix really was there to strip, i.e. this isn't a
      // vacuous assertion — chess.js's own isCheckmate() still fires for
      // this position (the concept still exists internally, it's just no
      // longer consulted for game-ending purposes elsewhere in the app).
      expect(chess.isCheckmate()).toBe(true);
    });
  });
});
