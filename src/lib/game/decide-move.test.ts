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

  it('accepts a move that leaves the mover\'s own king in check (Fog of War, ADR-0009)', () => {
    // White king e1 pinned-looking but not actually pinned to anything —
    // moving the e-file pawn opens the file to a black rook on e8. Under
    // the old rules this would be illegal (leaves the king in check);
    // under Fog of War it's a perfectly legal (if unwise) move.
    const game = baseGame({
      fen: '4r2k/8/8/8/8/8/4P3/4K3 w - - 0 1',
    });

    const outcome = decideMove(
      game,
      WHITE_ID,
      { from: 'e2', to: 'e4' },
      { now: 1000 },
    );

    expect(outcome.legal).toBe(true);
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
    const illegalMove = decideMove(
      baseGame(),
      WHITE_ID,
      { from: 'e2', to: 'e5' },
      { now: 1000 },
    );
    const notParticipant = decideMove(
      baseGame(),
      OUTSIDER_ID,
      { from: 'e2', to: 'e4' },
      { now: 1000 },
    );
    const notYourTurn = decideMove(
      baseGame(),
      BLACK_ID,
      { from: 'e7', to: 'e5' },
      { now: 1000 },
    );
    const inactiveGame = decideMove(
      baseGame({ status: 'waiting' }),
      WHITE_ID,
      { from: 'e2', to: 'e4' },
      { now: 1000 },
    );

    expect(illegalMove).toEqual(notParticipant);
    expect(notParticipant).toEqual(notYourTurn);
    expect(notYourTurn).toEqual(inactiveGame);
  });

  it('detects a king capture and assigns the mover as winner', () => {
    // Open a-file: white rook a1 slides all the way to a8, capturing the
    // black king directly — the whole game-ending mechanism under Fog of
    // War (ADR-0009), replacing checkmate detection.
    const game = baseGame({
      fen: 'k7/8/8/8/8/8/8/R6K w - - 0 1',
    });

    const outcome = decideMove(
      game,
      WHITE_ID,
      { from: 'a1', to: 'a8' },
      { now: 1000 },
    );

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.status).toBe('completed');
    expect(outcome.result).toBe('king_captured');
    expect(outcome.winnerId).toBe(WHITE_ID);
    expect(outcome.capturedPiece).toBe('k');
  });

  it('does NOT end the game on a move that would have been checkmate under the old rules', () => {
    // Scholar's-mate-style back-rank attack: under the old rules 4.Qxf7
    // would be checkmate. Under Fog of War there's no check/checkmate
    // concept — the queen has captured a pawn and is merely attacking the
    // king, which survives; the game continues until an actual king
    // capture happens.
    const game = baseGame({
      fen: '6k1/5ppp/8/8/8/8/8/R6K w - - 0 1',
    });

    const outcome = decideMove(
      game,
      WHITE_ID,
      { from: 'a1', to: 'a8' },
      { now: 1000 },
    );

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    // a8 is empty in this fixture (the king is on g8) — this is an
    // ordinary rook move, not a capture, and the game is still active.
    expect(outcome.capturedPiece).toBeNull();
    expect(outcome.status).toBe('active');
    expect(outcome.result).toBeNull();
  });

  it('detects a completed draw when the side to move has zero pseudo-legal moves', () => {
    // Stalemate's replacement under Fog of War: since check-safety no
    // longer restricts anything, having genuinely zero pseudo-legal moves
    // requires every one of the side's own pieces to be completely boxed
    // in by its own material — deliberately contrived (41 black pieces,
    // impossible to reach via real play) rather than a "realistic"
    // position, since that's what it actually takes to construct this
    // case at all once a king can walk into an attacked square. White
    // plays a no-op king step (h7-h8); black, to move next, has nothing
    // it can do.
    const game = baseGame({
      fen: 'kn6/pp1p3K/pppp4/pppp4/pppp4/pppppppp/pppppppp/nnnnnnnn w - - 0 1',
    });

    const outcome = decideMove(
      game,
      WHITE_ID,
      { from: 'h7', to: 'h8' },
      { now: 1000 },
    );

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.status).toBe('completed');
    expect(outcome.result).toBe('draw');
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

    const outcome = decideMove(
      game,
      BLACK_ID,
      { from: 'f6', to: 'g8' },
      { now: 1000 },
    );

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.status).toBe('completed');
    expect(outcome.result).toBe('draw');
    expect(outcome.winnerId).toBeNull();
  });

  it('does not falsely detect repetition from a fen-only fixture with no history', () => {
    // Sanity check for the fallback path itself: the king-capture fixture
    // above reuses a similar starting fen pattern to other tests via
    // baseGame(), but with an empty moveHistory it must not be treated as
    // a repeated position.
    const game = baseGame(); // start position, empty moveHistory
    const outcome = decideMove(
      game,
      WHITE_ID,
      { from: 'e2', to: 'e4' },
      { now: 1000 },
    );

    expect(outcome.legal).toBe(true);
    if (!outcome.legal) throw new Error('expected legal');
    expect(outcome.result).toBeNull();
  });

  it('detects insufficient-material draw as a completed draw with no winner', () => {
    const game = baseGame({
      fen: '4k3/8/8/8/4b3/3K4/8/8 w - - 0 1',
    });

    const outcome = decideMove(
      game,
      WHITE_ID,
      { from: 'd3', to: 'e4' },
      { now: 1000 },
    );

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

  it("rejects a move once the mover's deadline has lapsed, even though it would otherwise be legal", () => {
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

  // #30's "smoke test for critical flows" — every other test above calls
  // decideMove once against a hand-built fixture. This instead feeds each
  // move's own output (newFen, newCurrentTurn, moveText accumulated into
  // moveHistory) into the next call, the same way a real game actually
  // progresses move-by-move through this function — closer to what would
  // catch a real end-to-end regression than isolated single-call fixtures.
  it('plays a full game through to a king capture, move by move, each move built from the previous outcome', () => {
    // Scholar's-mate setup, but played through to an actual king capture
    // rather than stopping at the old checkmate move: 1. e4 e5 2. Qh5 Nc6
    // 3. Bc4 Nf6 4. Qxf7 (used to be mate — now just a capture, game goes
    // on) a6 (black plays an unrelated move; there's no check to answer)
    // 5. Qxe8 (the queen, still on f7, now captures the king outright).
    const moves: { from: string; to: string; color: string }[] = [
      { from: 'e2', to: 'e4', color: WHITE_ID },
      { from: 'e7', to: 'e5', color: BLACK_ID },
      { from: 'd1', to: 'h5', color: WHITE_ID },
      { from: 'b8', to: 'c6', color: BLACK_ID },
      { from: 'f1', to: 'c4', color: WHITE_ID },
      { from: 'g8', to: 'f6', color: BLACK_ID },
      { from: 'h5', to: 'f7', color: WHITE_ID },
      { from: 'a7', to: 'a6', color: BLACK_ID },
      { from: 'f7', to: 'e8', color: WHITE_ID },
    ];

    let game = baseGame();
    let lastOutcome: ReturnType<typeof decideMove> | null = null;

    for (const move of moves) {
      const outcome = decideMove(
        game,
        move.color,
        { from: move.from, to: move.to },
        { now: 1000 },
      );

      expect(outcome.legal).toBe(true);
      if (!outcome.legal)
        throw new Error(`expected ${move.from}-${move.to} to be legal`);

      lastOutcome = outcome;
      game = {
        ...game,
        fen: outcome.newFen,
        current_turn: outcome.newCurrentTurn,
        status: outcome.status,
        moveHistory: [...game.moveHistory, outcome.moveText],
      };
    }

    expect(lastOutcome?.status).toBe('completed');
    expect(lastOutcome?.result).toBe('king_captured');
    expect(lastOutcome?.winnerId).toBe(WHITE_ID);
    expect(lastOutcome?.moveText).toBe('Qxe8');
  });
});
