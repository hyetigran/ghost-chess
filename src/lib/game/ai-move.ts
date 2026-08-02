import { Chess, type Square } from 'chess.js';
import { chessFromRedactedFen } from '~/lib/game/redacted-chess';
import { pawnCaptureCandidates } from '~/lib/game/pawn-capture-candidates';
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
// human (chess.js's own legal moves for the AI's own pieces, widened
// with pawnCaptureCandidates for hidden-piece diagonal captures) — the
// AI has no more information or capability than a human looking at the
// same screen would.
//
// Deliberately no check-awareness: scoring a move by whether it delivers
// check would need to know where the opponent's king is, which is
// exactly the information occlusion hides — there's no way to compute
// "does this look like check" from a redacted view any more honestly
// than guessing. Scoring is limited to what's actually knowable: whether
// a target square might hold a piece (capture-shaped candidates), board
// geography (central control), and promotion.
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

function buildCandidates(chess: Chess): Candidate[] {
  const ownColor = chess.turn();
  const candidates: Candidate[] = [];

  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== ownColor) continue;
      const square = piece.square;

      const legalMoves = chess.moves({ square, verbose: true });
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
