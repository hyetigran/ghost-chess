import { timeControlLabel } from '~/lib/game/time-control-label';

describe('timeControlLabel', () => {
  it('describes 1 hour per move', () => {
    expect(timeControlLabel(1)).toBe('1 hour per move');
  });

  it('describes 12 hours per move', () => {
    expect(timeControlLabel(12)).toBe('12 hours per move');
  });

  it('describes 24 hours per move', () => {
    expect(timeControlLabel(24)).toBe('24 hours per move');
  });
});
