import { type Square } from 'chess.js';

const BLOBS_PER_SQUARE = 3;

export type CloudBlob = {
  /** Blob center, as a percentage (0–100) of the square's own box. */
  cx: number;
  cy: number;
  /** Blob footprint, as a percentage (0–100) of the square's side, on
   * each axis independently — unequal width/height is what makes a
   * near-max borderRadius render as a soft ellipse rather than a circle. */
  width: number;
  height: number;
  rotateDeg: number;
  /** Layer opacity. Blobs overlap, so stacking a few naturally produces a
   * denser, mottled core instead of one flat wash — no gradient asset
   * needed. */
  opacity: number;
  /** Radians, used to phase this blob's drift out of step with every
   * other blob sharing the same animation driver (cloud-fog-overlay.tsx)
   * — one shared clock still reads as independent motion per blob. */
  driftPhase: number;
};

/**
 * Deterministic per-square cloud layout: the same square always produces
 * the same blobs. Hazy squares get recomputed on every position change
 * (chess-board.tsx re-renders `isHazy` per move), and this also has to
 * agree between server-render and client-hydrate on web — a
 * Math.random()-seeded layout would reshuffle or flicker on every
 * re-render instead of reading as one stable patch of haze. Seeded from
 * the square name itself (not board index) so visually adjacent squares
 * don't end up with mirrored or identical layouts.
 */
export function cloudBlobsForSquare(square: Square): CloudBlob[] {
  const rand = mulberry32(hashSquare(square));
  return Array.from({ length: BLOBS_PER_SQUARE }, () => {
    const width = 55 + rand() * 45;
    const height = 55 + rand() * 45;
    return {
      cx: 20 + rand() * 60,
      cy: 20 + rand() * 60,
      width,
      height,
      rotateDeg: rand() * 360,
      opacity: 0.32 + rand() * 0.26,
      driftPhase: rand() * Math.PI * 2,
    };
  });
}

function hashSquare(square: string): number {
  let hash = 0;
  for (let i = 0; i < square.length; i++) {
    hash = (Math.imul(hash, 31) + square.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// mulberry32 — a tiny, dependency-free PRNG. Only used to spread
// `hashSquare`'s single integer across several uncorrelated [0, 1) draws
// per square; not used anywhere security- or fairness-sensitive, so a
// non-cryptographic generator is fine.
function mulberry32(seed: number): () => number {
  let state = seed;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
