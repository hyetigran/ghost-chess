import { type Square } from 'chess.js';

const TEXTURE_BLOBS_PER_SQUARE = 3;

/**
 * How far a square's whole fog patch drifts off its resting position at
 * the peak of its cycle, as a percentage of the square's side — small on
 * purpose (cloud-fog-overlay.tsx: this overlay's job is to read as
 * "obscured," not to draw the eye). Lives here, next to
 * `BASE_FILL_OVERHANG_PCT`, so the coverage margin below and the actual
 * drift distance can never drift apart from each other.
 */
export const DRIFT_AMPLITUDE_PCT = 3;

/**
 * How far the base fill (below) overhangs each edge of the square, as a
 * percentage of the square's side. Must clear `DRIFT_AMPLITUDE_PCT` with
 * real margin — the whole layout drifts as one unit (cloud-fog-overlay.tsx
 * applies translateX = sin(angle)·amplitude, translateY =
 * cos(angle)·amplitude off the same angle, which traces a circle of
 * radius exactly `DRIFT_AMPLITUDE_PCT`, so no axis ever moves further
 * than that) — an overhang any smaller than that radius would expose
 * bare checker at the trailing edge mid-drift, which is exactly the "fog
 * doesn't fill the square" bug this constant exists to prevent.
 */
export const BASE_FILL_OVERHANG_PCT = 15;

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
  /** Layer opacity. Blobs overlap the base fill and each other, so
   * stacking a few naturally produces a denser, mottled core instead of
   * one flat wash — no gradient asset needed. Coverage is never these
   * blobs' job (see `SquareFogLayout.baseOpacity`); they're purely
   * texture on top of a guaranteed-full square. */
  opacity: number;
};

export type SquareFogLayout = {
  /** Opacity of a full-square (plus `BASE_FILL_OVERHANG_PCT` overhang)
   * base fill beneath the texture blobs. This is what actually
   * guarantees the whole square reads as hazy: the old design relied
   * entirely on randomly placed/sized blobs to cover a square, which
   * could — and did — leave gaps showing bare checker wherever no blob
   * happened to reach. */
  baseOpacity: number;
  /** Single drift phase for the entire square's fog — base fill and
   * every texture blob move together as one patch (cloud-fog-overlay.tsx
   * applies this to one shared container transform), matching how this
   * variant's fog reads elsewhere as a slowly moving patch rather than
   * blobs shimmering independently against a static base. */
  driftPhase: number;
  blobs: CloudBlob[];
};

/**
 * Deterministic per-square cloud layout: the same square always produces
 * the same layout. Hazy squares get recomputed on every position change
 * (chess-board.tsx re-renders `isHazy` per move), and this also has to
 * agree between server-render and client-hydrate on web — a
 * Math.random()-seeded layout would reshuffle or flicker on every
 * re-render instead of reading as one stable patch of haze. Seeded from
 * the square name itself (not board index) so visually adjacent squares
 * don't end up with mirrored or identical layouts.
 */
export function squareFogLayout(square: Square): SquareFogLayout {
  const rand = mulberry32(hashSquare(square));
  // Deliberately lighter than the old blobs-only design's average
  // coverage: this is a floor, not the whole look. Kept low enough that
  // the texture blobs below — denser and, since #77's "cloud-like, not a
  // flat tint" goal still applies, doing most of the visual work — read
  // as genuine variation on top of it rather than the base dominating
  // into a flat wash.
  const baseOpacity = 0.42 + rand() * 0.16;
  const driftPhase = rand() * Math.PI * 2;
  const blobs = Array.from({ length: TEXTURE_BLOBS_PER_SQUARE }, () => {
    const width = 65 + rand() * 50;
    const height = 65 + rand() * 50;
    return {
      cx: 20 + rand() * 60,
      cy: 20 + rand() * 60,
      width,
      height,
      rotateDeg: rand() * 360,
      opacity: 0.32 + rand() * 0.24,
    };
  });
  return { baseOpacity, driftPhase, blobs };
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
