import { formatGameDate } from '~/lib/game/format-game-date';

// Fixed "now" so year-boundary behavior is deterministic rather than
// depending on when the test happens to run.
const NOW = new Date('2026-08-15T12:00:00.000Z');

describe('formatGameDate', () => {
  it('formats a same-year date without the year', () => {
    expect(formatGameDate('2026-03-02T10:00:00.000Z', NOW)).toBe('Mar 2');
  });

  it('includes the year for a date from a previous year', () => {
    expect(formatGameDate('2025-12-31T10:00:00.000Z', NOW)).toBe(
      'Dec 31, 2025',
    );
  });

  it('formats the current day itself', () => {
    expect(formatGameDate('2026-08-15T00:05:00.000Z', NOW)).toBe('Aug 15');
  });
});
