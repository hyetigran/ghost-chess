import { Chess, type Square } from 'chess.js';
import { chessFromRedactedFen } from '~/lib/game/redacted-chess';
import { pawnCaptureCandidates } from '~/lib/game/pawn-capture-candidates';
import { pseudoLegalMoves } from '~/lib/game/pseudo-legal-moves';
import { redactFen, type PieceColor } from '~/lib/game/redact-fen';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type AiMoveAttempt = {
  from: Square;
  to: Square;
  promotion?: string;
};

const CENTER_SQUARES = new Set(['d4', 'd5', 'e4', 'e5']);

type Candidate = AiMoveAttempt & { score: number };

// Composes redaction with move selection so the "redact, then choose"
// step is one tested unit rather than duplicated/hand-rolled at each call
// site — a caller that skipped redaction (passed the true fen straight to
// chooseAiMove) would be a real occlusion leak, and nothing short of a
// dedicated test (see ai-move.test.ts's differential test) would catch
// it, since chooseAiMove's own signature can't tell a redacted fen from
// an unredacted one.
export function chooseAiMoveFromTrueFen(
  trueFen: string,
  aiColor: PieceColor,
  difficulty: Difficulty,
  random: () => number = Math.random,
): AiMoveAttempt | null {
  return chooseAiMove(redactFen(trueFen, aiColor), difficulty, random);
}

// Chooses the AI's move from ONLY its own redacted view (#21, ADR-0004) —
// this function's signature is the enforcement point: it takes a FEN
// string and has no other way to learn anything about the game, so it
// structurally cannot read privileged board state. The candidate set
// built below is the exact same one useSquareSelection computes for a
// human (the shared pseudo-legal move generator for the AI's own pieces,
// widened with pawnCaptureCandidates for hidden-piece diagonal captures)
// — the AI has no more information or capability than a human looking at
// the same screen would.
//
// There's no check concept to be "aware" of under Fog of War (ADR-0009) —
// scoring is limited to what's actually knowable from a redacted view:
// whether a target square might hold a piece (capture-shaped candidates,
// including a king if one happens to be visible), board geography
// (central control), and promotion.
export function chooseAiMove(
  redactedFen: string,
  difficulty: Difficulty,
  random: () => number = Math.random,
): AiMoveAttempt | null {
  const chess = chessFromRedactedFen(redactedFen);
  const candidates = buildCandidates(chess);
  if (candidates.length === 0) return null;

  switch (difficulty) {
    case 'easy':
      return toAttempt(pickRandom(candidates, random));
    case 'medium':
      return toAttempt(pickWeighted(candidates, random));
    case 'hard':
      return toAttempt(pickBest(candidates, random));
  }
}

// Uses the shared pseudo-legal move generator (pseudo-legal-moves.ts)
// rather than chess.js's public, legal-filtered moves() — under Fog of
// War (ADR-0009) a move that leaves the AI's own king in check is legal,
// so its candidate set widens to match exactly what a human's own board
// now highlights (use-square-selection.ts uses the same generator). A
// king capture, if one of the AI's pieces happens to have vision of the
// opponent's king, is just another candidate that falls out of this the
// same way any other capture does — nothing king-capture-specific is
// needed here, scoreMove already rewards any capture.
function buildCandidates(chess: Chess): Candidate[] {
  const ownColor = chess.turn();
  const candidates: Candidate[] = [];

  const byFromSquare = new Map<Square, ReturnType<typeof pseudoLegalMoves>>();
  for (const move of pseudoLegalMoves(chess)) {
    const existing = byFromSquare.get(move.from);
    if (existing) existing.push(move);
    else byFromSquare.set(move.from, [move]);
  }

  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== ownColor) continue;
      const square = piece.square;

      const legalMoves = byFromSquare.get(square) ?? [];
      for (const move of legalMoves) {
        candidates.push({
          from: square,
          to: move.to,
          promotion: move.promotion,
          score: scoreMove(move.to, move.captured != null, move.promotion),
        });
      }

      if (piece.type === 'p') {
        const alreadyOffered = new Set(legalMoves.map((m) => m.to));
        for (const to of pawnCaptureCandidates(chess, square, ownColor)) {
          if (alreadyOffered.has(to)) continue;
          candidates.push({ from: square, to, score: scoreMove(to, true) });
        }
      }
    }
  }

  return candidates;
}

// Scoring only ever uses the move's destination and chess.js's own
// (own-pieces-only) verdict on it — never anything about the opponent.
// "Capture" here includes pawnCaptureCandidates' speculative diagonal
// squares, since those are exactly the squares worth attacking under
// occlusion even though the AI can't confirm anything is really there.
function scoreMove(
  to: Square,
  looksLikeCapture: boolean,
  promotion?: string,
): number {
  let score = 0;
  if (looksLikeCapture) score += 3;
  if (CENTER_SQUARES.has(to)) score += 2;
  if (promotion === 'q') score += 5;
  else if (promotion) score += 1;
  return score;
}

function pickRandom(candidates: Candidate[], random: () => number): Candidate {
  const index = Math.min(
    candidates.length - 1,
    Math.floor(random() * candidates.length),
  );
  return candidates[index];
}

function pickWeighted(
  candidates: Candidate[],
  random: () => number,
): Candidate {
  const weights = candidates.map((c) => c.score + 1);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let target = random() * total;
  for (let i = 0; i < candidates.length; i++) {
    target -= weights[i];
    if (target <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function pickBest(candidates: Candidate[], random: () => number): Candidate {
  const maxScore = Math.max(...candidates.map((c) => c.score));
  const best = candidates.filter((c) => c.score === maxScore);
  return pickRandom(best, random);
}

function toAttempt(candidate: Candidate): AiMoveAttempt {
  return candidate.promotion
    ? { from: candidate.from, to: candidate.to, promotion: candidate.promotion }
    : { from: candidate.from, to: candidate.to };
}

// Exhaustive, difficulty-ordered candidate list — unlike chooseAiMove (a
// single pick), a caller can walk this in order until one validates
// against the true board, instead of retrying a small fixed number of
// blind picks. Under Fog of War (ADR-0009) there's no "own king in check
// from an unseen piece" failure mode anymore (check-safety doesn't
// restrict any move), but a different reason for a candidate to fail
// remains: pawnCaptureCandidates' speculative diagonal targets can turn
// out to be genuinely empty on the true board, since occlusion hides more
// than piece identity, just not move-legality anymore. A single random
// pick can land on one of those; capped retries can exhaust themselves
// doing the same (worse for 'hard', which deterministically keeps
// re-picking from the same tied-for-best group). Walking the full list
// can't run out of things to try short of having zero pseudo-legal moves
// at all: redaction only hides *other* squares, never the mover's own
// piece geometry, so every true-legal move is guaranteed to already be
// somewhere in this list.
export function chooseAiMoveOrder(
  redactedFen: string,
  difficulty: Difficulty,
  random: () => number = Math.random,
): AiMoveAttempt[] {
  const chess = chessFromRedactedFen(redactedFen);
  const candidates = buildCandidates(chess);

  switch (difficulty) {
    case 'easy':
      return shuffled(candidates, random).map(toAttempt);
    case 'medium':
      return weightedShuffle(candidates, random).map(toAttempt);
    case 'hard':
      return bestFirst(candidates, random).map(toAttempt);
  }
}

export function chooseAiMoveOrderFromTrueFen(
  trueFen: string,
  aiColor: PieceColor,
  difficulty: Difficulty,
  random: () => number = Math.random,
): AiMoveAttempt[] {
  return chooseAiMoveOrder(redactFen(trueFen, aiColor), difficulty, random);
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Samples without replacement using the same score+1 weighting as a
// single pickWeighted pick, so the full order keeps medium's "usually a
// good move, but not always" character all the way through.
function weightedShuffle(
  candidates: Candidate[],
  random: () => number,
): Candidate[] {
  const remaining = [...candidates];
  const order: Candidate[] = [];
  while (remaining.length > 0) {
    const picked = pickWeighted(remaining, random);
    order.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
  }
  return order;
}

// Descending by score (hard's own preference), shuffled within each score
// band so ties don't always resolve in the same order.
function bestFirst(
  candidates: Candidate[],
  random: () => number,
): Candidate[] {
  const byScore = new Map<number, Candidate[]>();
  for (const candidate of candidates) {
    const group = byScore.get(candidate.score);
    if (group) group.push(candidate);
    else byScore.set(candidate.score, [candidate]);
  }
  const scoresDescending = [...byScore.keys()].sort((a, b) => b - a);
  return scoresDescending.flatMap((score) =>
    shuffled(byScore.get(score)!, random),
  );
}
