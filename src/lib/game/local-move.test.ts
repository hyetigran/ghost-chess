import { applyLocalMove } from '~/lib/game/local-move';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('applyLocalMove', () => {
  it('applies a legal move and returns the resulting state', () => {
    const outcome = applyLocalMove(START_FEN, { from: 'e2', to: 'e4' });

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.newFen).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    );
    expect(outcome.newCurrentTurn).toBe('black');
    expect(outcome.isCheck).toBe(false);
    expect(outcome.isGameOver).toBe(false);
    expect(outcome.result).toBeNull();
    expect(outcome.winner).toBeNull();
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

  it('detects checkmate and attributes the win to the side that just moved', () => {
    const outcome = applyLocalMove('6k1/5ppp/8/8/8/8/8/R6K w - - 0 1', {
      from: 'a1',
      to: 'a8',
    });

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.isGameOver).toBe(true);
    expect(outcome.result).toBe('checkmate');
    expect(outcome.winner).toBe('white');
    expect(outcome.isCheck).toBe(true);
  });

  it('detects stalemate as a game-ending draw with no winner', () => {
    const outcome = applyLocalMove('k7/8/1K6/8/8/8/8/7Q w - - 0 1', {
      from: 'h1',
      to: 'h2',
    });

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.isGameOver).toBe(true);
    expect(outcome.result).toBe('stalemate');
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

  it('attributes a black checkmate win correctly, not just white', () => {
    // Fool's mate: 1. f3 e5 2. g4 Qh4#.
    const beforeQh4Mate =
      'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2';

    const outcome = applyLocalMove(beforeQh4Mate, { from: 'd8', to: 'h4' });

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.result).toBe('checkmate');
    expect(outcome.winner).toBe('black');
  });
});
