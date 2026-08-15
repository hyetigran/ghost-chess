import { type Square } from 'chess.js';
import { cloudBlobsForSquare } from '~/lib/game/cloud-fog';

describe('cloudBlobsForSquare', () => {
  it('is deterministic for a given square', () => {
    expect(cloudBlobsForSquare('e4' as Square)).toEqual(
      cloudBlobsForSquare('e4' as Square),
    );
  });

  it('varies between squares, including squares sharing digits/letters', () => {
    const e4 = cloudBlobsForSquare('e4' as Square);
    const e5 = cloudBlobsForSquare('e5' as Square);
    const a4 = cloudBlobsForSquare('a4' as Square);
    expect(e4).not.toEqual(e5);
    expect(e4).not.toEqual(a4);
  });

  it('returns three overlapping blobs', () => {
    expect(cloudBlobsForSquare('d5' as Square)).toHaveLength(3);
  });

  it('keeps every blob within plausible on-square bounds', () => {
    for (const square of ['a1', 'h8', 'e4', 'b7'] as Square[]) {
      for (const blob of cloudBlobsForSquare(square)) {
        expect(blob.cx).toBeGreaterThanOrEqual(0);
        expect(blob.cx).toBeLessThanOrEqual(100);
        expect(blob.cy).toBeGreaterThanOrEqual(0);
        expect(blob.cy).toBeLessThanOrEqual(100);
        expect(blob.width).toBeGreaterThan(0);
        expect(blob.height).toBeGreaterThan(0);
        expect(blob.opacity).toBeGreaterThan(0);
        expect(blob.opacity).toBeLessThanOrEqual(1);
        expect(blob.driftPhase).toBeGreaterThanOrEqual(0);
        expect(blob.driftPhase).toBeLessThan(Math.PI * 2);
      }
    }
  });
});
