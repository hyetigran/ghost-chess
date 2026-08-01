import { winRatePercent } from '~/lib/game/win-rate';

describe('winRatePercent', () => {
  it('returns 0 when no games have been played', () => {
    expect(winRatePercent(0, 0, 0)).toBe(0);
  });

  it('returns 100 when every game was a win', () => {
    expect(winRatePercent(5, 0, 0)).toBe(100);
  });

  it('returns 0 when every game was a loss', () => {
    expect(winRatePercent(0, 5, 0)).toBe(0);
  });

  it('counts draws in the denominator but not the numerator', () => {
    expect(winRatePercent(1, 1, 2)).toBe(25);
  });

  it('rounds to the nearest whole percent', () => {
    expect(winRatePercent(1, 2, 0)).toBe(33);
  });
});
