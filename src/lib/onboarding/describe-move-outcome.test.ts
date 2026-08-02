import { describeMoveOutcome } from '~/lib/onboarding/describe-move-outcome';

describe('describeMoveOutcome', () => {
  it('is a capture when the piece count drops', () => {
    const before = '6k1/8/8/3p4/4P3/8/8/6K1 w - - 0 1';
    const after = '6k1/8/8/3P4/8/8/8/6K1 b - - 0 1';
    expect(describeMoveOutcome(before, after)).toBe('capture');
  });

  it('is quiet when the piece count is unchanged', () => {
    const before = '6k1/8/8/3p4/4P3/8/8/6K1 w - - 0 1';
    const after = '6k1/8/8/3p4/8/4P3/8/6K1 b - - 0 1';
    expect(describeMoveOutcome(before, after)).toBe('quiet');
  });
});
