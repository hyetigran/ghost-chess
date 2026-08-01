import type { GameSettings } from '~/types/database';

export function timeControlLabel(
  hours: GameSettings['timeControlHours'],
): string {
  return hours === 1 ? '1 hour per move' : `${hours} hours per move`;
}
