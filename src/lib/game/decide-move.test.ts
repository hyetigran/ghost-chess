import { decideMove, type GameSnapshot } from '~/lib/game/decide-move';

const WHITE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const BLACK_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OUTSIDER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function baseGame(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    current_turn: 'white',
    status: 'active',
    white_player_id: WHITE_ID,
    black_player_id: BLACK_ID,
    updated_at: new Date(1000).toISOString(),
    time_control_hours: 24,
    // Empty by default: most fixtures below use a hand-constructed `fen`
    // for a specific position (e.g. an endgame study) with no realistic
    // move sequence reaching it, which is fine for everything except
    // repetition — see the dedicated repetition test, which provides a
    // real moveHistory instead of a fen override.
    moveHistory: [],
    ...overrides,
  };
}

describe('decideMove', () => {
  it('accepts a legal move by the participant whose turn it is', () => {
    const outcome = decideMove(
      baseGame(),
      WHITE_ID,
      { from: 'e2', to: 'e4' },
      { now: 1000 },
    );

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.moveText).toBe('e4');
    // chess.js only reports an en passant target when a capture is
    // actually possible; no black pawn is adjacent to e4 here, so it's "-".
    expect(outcome.newFen).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    );
    expect(outcome.capturedPiece).toBeNull();
    expect(outcome.newCurrentTurn).toBe('black');
    expect(outcome.isCheck).toBe(false);
    expect(outcome.status).toBe('active');
    expect(outcome.result).toBeNull();
    expect(outcome.winnerId).toBeNull();
  });

  it('records the captured piece on a capturing move', () => {
    const game = baseGame({
      fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2',
    });

    const outcome = decideMove(
      game,
      WHITE_ID,
      { from: 'e4', to: 'd5' },
      { now: 1000 },
    );

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.capturedPiece).toBe('p');
  });

  it('rejects a geometrically illegal move', () => {
    const outcome = decideMove(
      baseGame(),
      WHITE_ID,
      { from: 'e2', to: 'e5' },
      { now: 1000 },
    );

    expect(outcome).toEqual({ legal: false });
  });

  it('rejects a move from someone who is not a participant in the game', () => {
    const outcome = decideMove(
      baseGame(),
      OUTSIDER_ID,
      { from: 'e2', to: 'e4' },
      { now: 1000 },
    );

    expect(outcome).toEqual({ legal: false });
  });

  it('rejects a move from a participant when it is not their turn', () => {
    const outcome = decideMove(
      baseGame(),
      BLACK_ID,
      { from: 'e7', to: 'e5' },
      { now: 1000 },
    );

    expect(outcome).toEqual({ legal: false });
  });

  it('rejects any move on a game that is not active, even a legal-looking one', () => {
    for (const status of ['waiting', 'completed', 'abandoned'] as const) {
      const outcome = decideMove(
        baseGame({ status }),
        WHITE_ID,
        { from: 'e2', to: 'e4' },
        { now: 1000 },
      );

      expect(outcome).toEqual({ legal: false });
    }
  });

  it('a rejection is identical in shape regardless of which of the above reasons caused it', () => {
    const illegalMove = decideMove(baseGame(), WHITE_ID, { from: 'e2', to: 'e5' }, { now: 1000 });
    const notParticipant = decideMove(baseGame(), OUTSIDER_ID, { from: 'e2', to: 'e4' }, { now: 1000 });
    const notYourTurn = decideMove(baseGame(), BLACK_ID, { from: 'e7', to: 'e5' }, { now: 1000 });
    const inactiveGame = decideMove(baseGame({ status: 'waiting' }), WHITE_ID, { from: 'e2', to: 'e4' }, { now: 1000 });

    expect(illegalMove).toEqual(notParticipant);
    expect(notParticipant).toEqual(notYourTurn);
    expect(notYourTurn).toEqual(inactiveGame);
  });

  it('detects checkmate and assigns the mover as winner', () => {
    const game = baseGame({
      fen: '6k1/5ppp/8/8/8/8/8/R6K w - - 0 1',
      white_player_id: WHITE_ID,
      black_player_id: BLACK_ID,
    });

    const outcome = decideMove(game, WHITE_ID, { from: 'a1', to: 'a8' }, { now: 1000 });

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.status).toBe('completed');
    expect(outcome.result).toBe('checkmate');
    expect(outcome.winnerId).toBe(WHITE_ID);
    expect(outcome.isCheck).toBe(true);
  });

  it('detects stalemate as a completed draw with no winner', () => {
    const game = baseGame({
      fen: 'k7/8/1K6/8/8/8/8/7Q w - - 0 1',
    });

    const outcome = decideMove(game, WHITE_ID, { from: 'h1', to: 'h2' }, { now: 1000 });

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.status).toBe('completed');
    expect(outcome.result).toBe('stalemate');
    expect(outcome.winnerId).toBeNull();
  });

  it('detects threefold repetition as a completed draw, using replayed history rather than the bare fen', () => {
    // Knights shuffle out and back three times, reaching the start
    // position each time. A bare `new Chess(fen)` has no memory of the
    // earlier two occurrences and could never detect this — only a Chess
    // instance built by replaying the full history from move 1 can.
    const game = baseGame({
      fen: 'rnbqkb1r/pppppppp/5n2/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 7 4',
      current_turn: 'black',
      moveHistory: ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1'],
    });

    const outcome = decideMove(game, BLACK_ID, { from: 'f6', to: 'g8' }, { now: 1000 });

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.status).toBe('completed');
    expect(outcome.result).toBe('draw');
    expect(outcome.winnerId).toBeNull();
  });

  it('does not falsely detect repetition from a fen-only fixture with no history', () => {
    // Sanity check for the fallback path itself: the checkmate fixture
    // above reuses the same starting fen pattern as other tests via
    // baseGame(), but with an empty moveHistory it must not be treated as
    // a repeated position.
    const game = baseGame(); // start position, empty moveHistory
    const outcome = decideMove(game, WHITE_ID, { from: 'e2', to: 'e4' }, { now: 1000 });

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.result).toBeNull();
  });

  it('detects insufficient-material draw as a completed draw with no winner', () => {
    const game = baseGame({
      fen: '4k3/8/8/8/4b3/3K4/8/8 w - - 0 1',
    });

    const outcome = decideMove(game, WHITE_ID, { from: 'd3', to: 'e4' }, { now: 1000 });

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.status).toBe('completed');
    expect(outcome.result).toBe('draw');
    expect(outcome.winnerId).toBeNull();
  });

  it('accepts a move made right up until the deadline', () => {
    const turnStarted = new Date('2026-01-01T00:00:00.000Z').getTime();
    const game = baseGame({
      updated_at: new Date(turnStarted).toISOString(),
      time_control_hours: 1,
    });

    const outcome = decideMove(
      game,
      WHITE_ID,
      { from: 'e2', to: 'e4' },
      { now: turnStarted + 59 * 60 * 1000 }, // 59 minutes in, 1 to go
    );

    expect(outcome.legal).toBe(true);
  });

  it('rejects a move once the mover\'s deadline has lapsed, even though it would otherwise be legal', () => {
    const turnStarted = new Date('2026-01-01T00:00:00.000Z').getTime();
    const game = baseGame({
      updated_at: new Date(turnStarted).toISOString(),
      time_control_hours: 1,
    });

    const outcome = decideMove(
      game,
      WHITE_ID,
      { from: 'e2', to: 'e4' },
      { now: turnStarted + 60 * 60 * 1000 }, // exactly at the deadline
    );

    expect(outcome).toEqual({ legal: false });
  });

  it('a deadline-lapsed rejection is identical in shape to every other rejection reason', () => {
    const turnStarted = new Date('2026-01-01T00:00:00.000Z').getTime();
    const game = baseGame({
      updated_at: new Date(turnStarted).toISOString(),
      time_control_hours: 1,
    });

    const lapsed = decideMove(
      game,
      WHITE_ID,
      { from: 'e2', to: 'e4' },
      { now: turnStarted + 2 * 60 * 60 * 1000 },
    );
    const notYourTurn = decideMove(
      baseGame(),
      BLACK_ID,
      { from: 'e7', to: 'e5' },
      { now: 1000 },
    );

    expect(lapsed).toEqual(notYourTurn);
  });

  it('rejects malformed square input without throwing', () => {
    expect(() =>
      decideMove(baseGame(), WHITE_ID, { from: 'z9', to: 'e4' }, { now: 1000 }),
    ).not.toThrow();

    const outcome = decideMove(
      baseGame(),
      WHITE_ID,
      { from: 'z9', to: 'e4' },
      { now: 1000 },
    );
    expect(outcome).toEqual({ legal: false });
  });
});
