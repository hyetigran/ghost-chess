import { resolveHumanColor } from '~/lib/game/resolve-human-color';

describe('resolveHumanColor', () => {
  it('returns white as-is', () => {
    expect(resolveHumanColor('white')).toBe('white');
  });

  it('returns black as-is', () => {
    expect(resolveHumanColor('black')).toBe('black');
  });

  it('resolves random to white when the roll is below 0.5', () => {
    expect(resolveHumanColor('random', () => 0.2)).toBe('white');
  });

  it('resolves random to black when the roll is 0.5 or above', () => {
    expect(resolveHumanColor('random', () => 0.5)).toBe('black');
    expect(resolveHumanColor('random', () => 0.9)).toBe('black');
  });
});
