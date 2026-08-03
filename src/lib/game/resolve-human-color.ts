import type { Color } from '~/lib/game/local-move';

export type ColorChoice = Color | 'random';

export function resolveHumanColor(
  choice: ColorChoice,
  random: () => number = Math.random,
): Color {
  if (choice !== 'random') return choice;
  return random() < 0.5 ? 'white' : 'black';
}
