// Compact "time left" readout shared by every game-list row on home
// (previously duplicated inside game-queue-list.tsx, which #83 removed —
// extracted here so the horizontal active-games list and any future
// consumer stay in sync by construction, not by eye).
export function formatTimeRemaining(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  if (hours >= 1) {
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
