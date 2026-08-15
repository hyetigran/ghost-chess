import { formatTimeRemaining } from '~/lib/game/format-time-remaining';

describe('formatTimeRemaining', () => {
  it('formats sub-minute remainders as M:SS', () => {
    expect(formatTimeRemaining(0)).toBe('0:00');
    expect(formatTimeRemaining(5)).toBe('0:05');
    expect(formatTimeRemaining(90)).toBe('1:30');
  });

  it('formats sub-hour remainders as Hh Mm once at least an hour remains', () => {
    expect(formatTimeRemaining(3600)).toBe('1h 0m');
    expect(formatTimeRemaining(3600 * 5 + 60 * 30)).toBe('5h 30m');
  });

  it('formats sub-day remainders in hours up to 23h', () => {
    expect(formatTimeRemaining(3600 * 23)).toBe('23h 0m');
  });

  it('formats day-plus remainders as Dd Hh', () => {
    expect(formatTimeRemaining(3600 * 24)).toBe('1d 0h');
    expect(formatTimeRemaining(3600 * 30)).toBe('1d 6h');
    expect(formatTimeRemaining(3600 * 49)).toBe('2d 1h');
  });
});
