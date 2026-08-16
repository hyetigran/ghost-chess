import { type Square } from 'chess.js';
import { BASE_FILL_OVERHANG_PCT, squareFogLayout } from '~/lib/game/cloud-fog';

describe('squareFogLayout', () => {
  it('is deterministic for a given square', () => {
    expect(squareFogLayout('e4' as Square)).toEqual(
      squareFogLayout('e4' as Square),
    );
  });

  it('varies between squares, including squares sharing digits/letters', () => {
    const e4 = squareFogLayout('e4' as Square);
    const e5 = squareFogLayout('e5' as Square);
    const a4 = squareFogLayout('a4' as Square);
    expect(e4).not.toEqual(e5);
    expect(e4).not.toEqual(a4);
  });

  it('returns three overlapping texture blobs', () => {
    expect(squareFogLayout('d5' as Square).blobs).toHaveLength(3);
  });

  it('keeps every texture blob within plausible on-square bounds', () => {
    for (const square of ['a1', 'h8', 'e4', 'b7'] as Square[]) {
      for (const blob of squareFogLayout(square).blobs) {
        expect(blob.cx).toBeGreaterThanOrEqual(0);
        expect(blob.cx).toBeLessThanOrEqual(100);
        expect(blob.cy).toBeGreaterThanOrEqual(0);
        expect(blob.cy).toBeLessThanOrEqual(100);
        expect(blob.width).toBeGreaterThan(0);
        expect(blob.height).toBeGreaterThan(0);
        expect(blob.opacity).toBeGreaterThan(0);
        expect(blob.opacity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gives every square a full-coverage base fill and a single drift phase', () => {
    for (const square of ['a1', 'h8', 'e4', 'b7'] as Square[]) {
      const layout = squareFogLayout(square);
      expect(layout.baseOpacity).toBeGreaterThan(0);
      expect(layout.baseOpacity).toBeLessThanOrEqual(1);
      expect(layout.driftPhase).toBeGreaterThanOrEqual(0);
      expect(layout.driftPhase).toBeLessThan(Math.PI * 2);
    }
  });

  it('overhangs the square by comfortably more than the drift amplitude, so drift can never expose bare checker', () => {
    // cloud-fog-overlay.tsx's DRIFT_AMPLITUDE_PCT is 3 — the worst-case
    // translate offset (both axes near their peak at once) is bounded by
    // amplitude * sqrt(2) ≈ 4.24. The base fill's overhang must clear
    // that with real margin on every side.
    const worstCaseDriftPct = 3 * Math.SQRT2;
    expect(BASE_FILL_OVERHANG_PCT).toBeGreaterThan(worstCaseDriftPct * 2);
  });
});
