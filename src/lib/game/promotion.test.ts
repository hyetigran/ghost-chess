import { Chess } from 'chess.js';
import { isPromotionMove } from './promotion';

describe('isPromotionMove', () => {
  it('detects a white pawn push to the eighth rank', () => {
    const chess = new Chess('8/4P3/8/8/8/8/8/K6k w - - 0 1');
    expect(isPromotionMove(chess, 'e7', 'e8')).toBe(true);
  });

  it('detects a black pawn push to the first rank', () => {
    const chess = new Chess('k6K/8/8/8/8/8/4p3/8 b - - 0 1');
    expect(isPromotionMove(chess, 'e2', 'e1')).toBe(true);
  });

  it('detects a diagonal capture-promotion, including into fog', () => {
    // The target square is empty on this (redacted) board — exactly the
    // fog capture-promotion case, where the pawn attacks a square whose
    // occupant it cannot see. Still a promotion attempt.
    const chess = new Chess('8/4P3/8/8/8/8/8/K6k w - - 0 1');
    expect(isPromotionMove(chess, 'e7', 'd8')).toBe(true);
  });

  it('is false for a pawn move short of the last rank', () => {
    const chess = new Chess('8/8/4P3/8/8/8/8/K6k w - - 0 1');
    expect(isPromotionMove(chess, 'e6', 'e7')).toBe(false);
  });

  it('is false for a non-pawn reaching the last rank', () => {
    const chess = new Chess('8/8/4N3/8/8/8/8/K6k w - - 0 1');
    expect(isPromotionMove(chess, 'e6', 'd8')).toBe(false);
  });

  it('is false for a white pawn moving to the first rank square name (empty from-square)', () => {
    const chess = new Chess('8/4P3/8/8/8/8/8/K6k w - - 0 1');
    expect(isPromotionMove(chess, 'a3', 'a8')).toBe(false);
  });
});
