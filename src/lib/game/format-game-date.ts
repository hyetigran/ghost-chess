// Compact "played on" date for a history row (#84) — "Mar 2" for a game
// from the current year, "Dec 31, 2025" once it's rolled into a previous
// one, so old rows stay disambiguated without cluttering every row with a
// year. Pinned to UTC (both the parse and the formatter) so the label is
// deterministic regardless of the device's timezone or when a test runs.
export function formatGameDate(createdAt: string, now: Date = new Date()): string {
  const date = new Date(createdAt);
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear();

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
