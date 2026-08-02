import { Chess } from 'chess.js';
import { chooseAiMove, chooseAiMoveFromTrueFen } from '~/lib/game/ai-move';

describe('chooseAiMove', () => {
  it('returns null when the side to move has no legal moves (stalemate)', () => {
    const move = chooseAiMove('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 'easy');
    expect(move).toBeNull();
  });

  it('never returns a move whose "from" square is not one of the AI\'s own pieces in the given fen — the only channel it has any information through', () => {
    // A realistic occluded position: white to move, only white's own
    // pieces are present in the fen (redaction already applied by the
    // caller) — black's real pieces exist on the true board but are
    // structurally absent here, the same as any real redacted_fen.
    const redactedFen = '8/8/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQ - 0 1';
    const chess = new Chess(redactedFen, { skipValidation: true });

    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const move = chooseAiMove(redactedFen, difficulty, () => 0.5);
      expect(move).not.toBeNull();
      if (!move) continue;
      const piece = chess.get(move.from);
      expect(piece?.color).toBe('w');
    }
  });

  it("easy: always returns one of the position's real legal moves, and the injected random function actually drives which one", () => {
    const fen = '8/8/8/8/8/2N5/8/K6k w - - 0 1';
    const chess = new Chess(fen);
    const legalMoves = new Set(
      chess.moves({ verbose: true }).map((m) => `${m.from}-${m.to}`),
    );

    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const move = chooseAiMove(fen, 'easy', () => i / 20);
      expect(move).not.toBeNull();
      if (!move) continue;
      const key = `${move.from}-${move.to}`;
      expect(legalMoves.has(key)).toBe(true);
      seen.add(key);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('hard: always prefers a central square over an edge square', () => {
    const fen = '8/8/8/8/8/2N5/8/K6k w - - 0 1';
    const centerSquares = new Set(['d4', 'd5', 'e4', 'e5']);

    for (const random of [0, 0.25, 0.5, 0.75, 0.999]) {
      const move = chooseAiMove(fen, 'hard', () => random);
      expect(move?.from).toBe('c3');
      expect(centerSquares.has(move!.to)).toBe(true);
    }
  });

  it('medium: still only ever returns a real legal move for the position', () => {
    const fen = '8/8/8/8/8/2N5/8/K6k w - - 0 1';
    const chess = new Chess(fen);
    const legalMoves = new Set(
      chess.moves({ verbose: true }).map((m) => `${m.from}-${m.to}`),
    );

    for (const random of [0, 0.1, 0.4, 0.6, 0.9, 0.999]) {
      const move = chooseAiMove(fen, 'medium', () => random);
      expect(move).not.toBeNull();
      if (!move) continue;
      expect(legalMoves.has(`${move.from}-${move.to}`)).toBe(true);
    }
  });

  it("offers a hidden-piece pawn-capture candidate the same way a human's legal-target highlighting would", () => {
    // Mirrors pawn-capture-candidates.test.ts's own fixture: a white pawn
    // on e4 with an invisible black pawn actually on d5 (redacted away),
    // so chess.js's own generation only offers e5 — the diagonal d5
    // capture only shows up because chooseAiMove widens the candidate
    // set the same way useSquareSelection does for a human.
    const redactedFen = '8/8/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQ - 0 1';

    let sawHiddenCaptureCandidate = false;
    for (let i = 0; i < 50; i++) {
      const move = chooseAiMove(redactedFen, 'easy', () => i / 50);
      if (move?.from === 'e4' && move.to === 'd5') {
        sawHiddenCaptureCandidate = true;
        break;
      }
    }
    expect(sawHiddenCaptureCandidate).toBe(true);
  });
});

describe('chooseAiMoveFromTrueFen', () => {
  it('actually redacts the true fen before choosing — a caller that skipped redaction would pick a different move', () => {
    // Black rook a8 can slide all the way to a1, where a white rook
    // really sits (a genuine capture) — reachable either way, since
    // redaction hides identity, not connectivity, so this isn't about
    // whether the move is offered, only how it scores. Black knight d7
    // can reach e5, a center square, unaffected by redaction either way.
    const trueFen = 'r6k/3n4/8/8/8/8/6K1/R7 b - - 0 1';

    // Fed the true fen directly (the bug this composition exists to
    // prevent, per its own doc comment): chess.js sees the real capture
    // on a1 (scores 3, uniquely highest — knight-e5's center bonus is
    // only 2), so 'hard' always picks it.
    const buggyMove = chooseAiMove(trueFen, 'hard', () => 0.5);
    expect(buggyMove).toEqual({ from: 'a8', to: 'a1' });

    // Fed through the real composition: a1 is invisible to black, so
    // that same move now scores 0 (an ordinary quiet move, no capture
    // flag) — knight-e5's center bonus (2) is uniquely highest instead.
    const correctMove = chooseAiMoveFromTrueFen(
      trueFen,
      'black',
      'hard',
      () => 0.5,
    );
    expect(correctMove).toEqual({ from: 'd7', to: 'e5' });

    expect(correctMove).not.toEqual(buggyMove);
  });
});
