import { formatTime } from '~/lib/utils/time';

describe('formatTime', () => {
  it('formats sub-minute durations as M:SS', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(45)).toBe('0:45');
  });

  it('formats sub-hour durations as M:SS without an hour component', () => {
    expect(formatTime(9 * 60 + 5)).toBe('9:05');
    expect(formatTime(59 * 60 + 59)).toBe('59:59');
  });

  it('adds an hour component once the duration reaches an hour', () => {
    expect(formatTime(60 * 60)).toBe('1:00:00');
    expect(formatTime(23 * 3600 + 59 * 60 + 45)).toBe('23:59:45');
  });

  it('zero-pads minutes and seconds once hours are shown', () => {
    expect(formatTime(3600 + 5 * 60 + 9)).toBe('1:05:09');
  });
});
