import { ratingClassRange } from '~/lib/game/rating-class';

describe('ratingClassRange', () => {
  it('buckets a rating into its 200-point band', () => {
    expect(ratingClassRange(1250)).toEqual({
      min: 1200,
      max: 1399,
      label: '1200–1399',
    });
  });

  it('handles a rating that already sits exactly on a band boundary', () => {
    expect(ratingClassRange(1400)).toEqual({
      min: 1400,
      max: 1599,
      label: '1400–1599',
    });
  });

  it('handles a low rating near the floor', () => {
    expect(ratingClassRange(120)).toEqual({
      min: 0,
      max: 199,
      label: '0–199',
    });
  });
});
