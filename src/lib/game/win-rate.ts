export function winRatePercent(
  wins: number,
  losses: number,
  draws: number,
): number {
  const total = wins + losses + draws;
  if (total === 0) return 0;
  return Math.round((wins / total) * 100);
}
