// Per-move deadlines (docs/adr/0006) run up to 24 hours, not just minutes
// — M:SS alone would show something unreadable like "1439:45" for a
// nearly-full 24h window, so this adds an H: prefix once the duration
// reaches an hour.
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const paddedMinutes =
    hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const paddedSeconds = remainingSeconds.toString().padStart(2, '0');
  return hours > 0
    ? `${hours}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`;
}
