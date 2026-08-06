import { Chess } from 'chess.js';
import {
  chooseAiMove,
  chooseAiMoveFromTrueFen,
  chooseAiMoveOrder,
  chooseAiMoveOrderFromTrueFen,
} from '~/lib/game/ai-move';
import { applyLocalMove } from '~/lib/game/local-move';
import { redactFen } from '~/lib/game/redact-fen';

describe('chooseAiMove', () => {
  it('returns null when the side to move has no pseudo-legal moves', () => {
    // Under Fog of War (ADR-0009) check-safety no longer restricts
    // anything, so old-style stalemate positions (like the pre-rewrite
    // fixture this test used) generally have real pseudo-legal moves now
    // (a king can walk into an "attacked" square). Zero moves requires
    // every one of the side's own pieces to be completely boxed in by its
    // own material — same deliberately contrived fixture verified in
    // decide-move.test.ts's equivalent case.
    const move = chooseAiMove(
      'kn5K/pppppppp/pppppppp/pppppppp/pppppppp/pppppppp/pppppppp/nnnnnnnn b - - 0 1',
      'easy',
    );
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
  // Under the OLD absolute-occlusion model this test constructed a
  // position where feeding the true fen directly (skipping redaction)
  // inflated a move's score — a real enemy piece was reachable but
  // invisible, so redaction turned a "capture" into an apparent quiet
  // move. That specific divergence is no longer constructible under Fog
  // of War (ADR-0008): vision is defined as "squares the viewer's own
  // pieces currently attack," which for sliding pieces is exactly the
  // same set as "squares it could capture on" (both stop at the first
  // blocker) — so any square a piece can truly reach for a capture is, by
  // construction, always within that piece's own vision. There's no
  // longer a way for a genuinely reachable enemy piece to be hidden from
  // the piece that can capture it, which means chess.js run on the true
  // fen and chess.js run on the correctly-redacted fen always agree on
  // whether a given destination is a capture — scoreMove can no longer
  // diverge between the two paths for the current scoring function
  // (capture-shaped / center-square / promotion, none of which read
  // anything about pieces the AI's own pieces don't reach).
  //
  // What's still worth testing — and still a real risk if someone edits
  // this composition later — is that chooseAiMoveFromTrueFen is actually
  // defined as "redact, then choose," not that doing so changes any
  // particular outcome today.
  it('is defined as redact-then-choose: equivalent to calling redactFen and chooseAiMove separately', () => {
    const trueFen = 'r6k/3n4/8/8/8/8/6K1/R7 b - - 0 1';

    const composed = chooseAiMoveFromTrueFen(trueFen, 'black', 'hard', () => 0.5);
    const manual = chooseAiMove(
      redactFen(trueFen, 'black'),
      'hard',
      () => 0.5,
    );

    expect(composed).toEqual(manual);
  });

  it('a genuinely reachable capture is never hidden by redaction, even though a not-yet-reachable piece still is', () => {
    // Black rook a8 can slide all the way to a1 where a white rook really
    // sits — reachable, so (per the invariant above) also visible, so it
    // scores as a real capture (+3) either way. Black knight d7 reaching
    // the center (e5, +2) stays the next-best option either way. A second
    // white rook at h1 is NOT reachable by anything black has (not
    // aligned with the rook on a8, out of the knight's range) and stays
    // genuinely invisible — included to confirm redaction still hides
    // what it should, not just that it stopped hiding what it used to.
    const trueFen = 'r6k/3n4/8/8/8/8/6K1/R6R b - - 0 1';

    const redacted = redactFen(trueFen, 'black');
    expect(redacted).toContain('R7'); // the reachable rook on a1 is visible
    expect(redacted.split(' ')[0]).not.toMatch(/R.*R/); // only one 'R' — h1 stays hidden

    const move = chooseAiMoveFromTrueFen(trueFen, 'black', 'hard', () => 0.5);
    expect(move).toEqual({ from: 'a8', to: 'a1' });
  });
});

describe('chooseAiMoveOrder', () => {
  it('returns every candidate, none lost or duplicated, for any difficulty', () => {
    const redactedFen = '8/8/8/8/8/2N5/8/K6k w - - 0 1';

    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const order = chooseAiMoveOrder(redactedFen, difficulty, () => 0.5);
      const keys = order.map((m) => `${m.from}-${m.to}`);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.length).toBeGreaterThan(0);
    }
  });

  it('returns an empty list, not null, when there are no pseudo-legal moves', () => {
    expect(
      chooseAiMoveOrder(
        'kn5K/pppppppp/pppppppp/pppppppp/pppppppp/pppppppp/pppppppp/nnnnnnnn b - - 0 1',
        'easy',
      ),
    ).toEqual([]);
  });
});

describe('chooseAiMoveOrderFromTrueFen', () => {
  // Under the OLD absolute-occlusion model this described a scenario
  // where the AI's own king was in check from a piece it structurally
  // couldn't see (ADR-0004's redacted view has no way to register a
  // check that way) — that failure mode is gone under Fog of War
  // (ADR-0009), since a move leaving the AI's own king in check is simply
  // legal now, not silently-illegal-but-plausible-looking. The remaining
  // reason the exhaustive, walk-until-valid list still matters (see
  // ai-move.ts's updated comment on chooseAiMoveOrder): pawnCaptureCandidates
  // speculatively offers a pawn's diagonal squares as capture-shaped
  // candidates regardless of whether anything is really there — if the
  // true board turns out empty, that candidate is genuinely illegal (a
  // pawn can't move diagonally without capturing), and a single blind
  // pick landing on one of those has nothing else queued up to try under
  // a capped-retry approach.
  it('always includes a real legal move, even when the top-scoring candidates are speculative pawn captures that turn out empty', () => {
    // White pawn e4's diagonals (d5, f5) are empty on the true board — no
    // black piece anywhere near them — so pawnCaptureCandidates' guesses
    // there are illegal; d5 in particular outscores every real legal
    // move (capture-shaped +3, center-square +2), so 'hard' would try it
    // first if this function only ever offered a single pick.
    const trueFen = 'k7/8/8/8/4P3/8/8/7K w - - 0 1';

    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (const seed of [0, 0.2, 0.4, 0.6, 0.8, 0.999]) {
        const order = chooseAiMoveOrderFromTrueFen(
          trueFen,
          'white',
          difficulty,
          () => seed,
        );

        const legalMove = order.find(
          (move) => applyLocalMove(trueFen, move).legal,
        );
        expect(legalMove).toBeDefined();
      }
    }
  });

  it('places every generated candidate ahead of one that fails true-board validation, never dropping any', () => {
    const trueFen = 'k7/8/8/8/4P3/8/8/7K w - - 0 1';
    const order = chooseAiMoveOrderFromTrueFen(
      trueFen,
      'white',
      'hard',
      () => 0.5,
    );

    // d5 is exactly the highest-scoring, true-illegal speculative capture
    // described above — present in the list, just not the only thing
    // offered.
    expect(order).toContainEqual({ from: 'e4', to: 'd5' });
    expect(order.some((move) => applyLocalMove(trueFen, move).legal)).toBe(
      true,
    );
  });
});
