import { applyLocalMove, nextPhaseAfterMove } from '~/lib/game/local-move';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function legalOutcome(fen: string, attempt: { from: string; to: string }) {
  const outcome = applyLocalMove(fen, attempt);
  if (!outcome.legal) throw new Error('expected legal');
  return outcome;
}

describe('applyLocalMove', () => {
  it('applies a legal move and returns the resulting state', () => {
    const outcome = applyLocalMove(START_FEN, { from: 'e2', to: 'e4' });

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.newFen).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    );
    expect(outcome.newCurrentTurn).toBe('black');
    expect(outcome.isGameOver).toBe(false);
    expect(outcome.result).toBeNull();
    expect(outcome.winner).toBeNull();
    expect(outcome.captured).toBeNull();
    expect(outcome.san).toBe('e4');
    expect(outcome.mover).toBe('white');
  });

  it('reports the captured piece and the capturing color', () => {
    // 1. e4 d5 2. exd5 - white's pawn captures black's pawn on d5.
    const beforeCapture =
      'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';

    const outcome = applyLocalMove(beforeCapture, { from: 'e4', to: 'd5' });

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.captured).toEqual({ by: 'white', pieceType: 'p' });
    expect(outcome.san).toBe('exd5');
  });

  it('rejects a geometrically illegal move rather than throwing', () => {
    const outcome = applyLocalMove(START_FEN, { from: 'e2', to: 'e5' });

    expect(outcome).toEqual({ legal: false });
  });

  it('rejects malformed square input without throwing', () => {
    expect(() =>
      applyLocalMove(START_FEN, { from: 'z9', to: 'e4' }),
    ).not.toThrow();
    expect(applyLocalMove(START_FEN, { from: 'z9', to: 'e4' })).toEqual({
      legal: false,
    });
  });

  it('accepts a move that leaves the mover\'s own king in check (Fog of War, ADR-0009)', () => {
    const outcome = applyLocalMove('4r2k/8/8/8/8/8/4P3/4K3 w - - 0 1', {
      from: 'e2',
      to: 'e4',
    });

    expect(outcome.legal).toBe(true);
  });

  it('detects a king capture and attributes the win to the side that just moved', () => {
    const outcome = applyLocalMove('k7/8/8/8/8/8/8/R6K w - - 0 1', {
      from: 'a1',
      to: 'a8',
    });

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.isGameOver).toBe(true);
    expect(outcome.result).toBe('king_captured');
    expect(outcome.winner).toBe('white');
    expect(outcome.captured).toEqual({ by: 'white', pieceType: 'k' });
  });

  it('attributes a black king-capture win correctly, not just white', () => {
    const outcome = applyLocalMove('r6k/8/8/8/8/8/8/K7 b - - 0 1', {
      from: 'a8',
      to: 'a1',
    });

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.result).toBe('king_captured');
    expect(outcome.winner).toBe('black');
  });

  it('does NOT end the game on a move that would have been checkmate under the old rules', () => {
    const outcome = applyLocalMove('6k1/5ppp/8/8/8/8/8/R6K w - - 0 1', {
      from: 'a1',
      to: 'a8',
    });

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.captured).toBeNull();
    expect(outcome.isGameOver).toBe(false);
    expect(outcome.result).toBeNull();
  });

  it('detects a completed draw when the side to move has zero pseudo-legal moves', () => {
    const outcome = applyLocalMove(
      'kn6/pp1p3K/pppp4/pppp4/pppp4/pppppppp/pppppppp/nnnnnnnn w - - 0 1',
      { from: 'h7', to: 'h8' },
    );

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.isGameOver).toBe(true);
    expect(outcome.result).toBe('draw');
    expect(outcome.winner).toBeNull();
  });

  it('detects an insufficient-material draw with no winner', () => {
    const outcome = applyLocalMove('4k3/8/8/8/4b3/3K4/8/8 w - - 0 1', {
      from: 'd3',
      to: 'e4',
    });

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.isGameOver).toBe(true);
    expect(outcome.result).toBe('draw');
    expect(outcome.winner).toBeNull();
  });
});

describe('nextPhaseAfterMove', () => {
  it('transitions to handoff for the other color after a non-ending move', () => {
    const outcome = legalOutcome(START_FEN, { from: 'e2', to: 'e4' });

    expect(nextPhaseAfterMove(outcome)).toEqual({
      type: 'handoff',
      nextViewer: 'black',
    });
  });

  it('transitions to gameOver with the winner after a king capture', () => {
    const outcome = legalOutcome('k7/8/8/8/8/8/8/R6K w - - 0 1', {
      from: 'a1',
      to: 'a8',
    });

    expect(nextPhaseAfterMove(outcome)).toEqual({
      type: 'gameOver',
      result: 'king_captured',
      winner: 'white',
    });
  });

  it('transitions to gameOver with no winner after a no-legal-moves draw', () => {
    const outcome = legalOutcome(
      'kn6/pp1p3K/pppp4/pppp4/pppp4/pppppppp/pppppppp/nnnnnnnn w - - 0 1',
      { from: 'h7', to: 'h8' },
    );

    expect(nextPhaseAfterMove(outcome)).toEqual({
      type: 'gameOver',
      result: 'draw',
      winner: null,
    });
  });
});
