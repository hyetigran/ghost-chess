import { urgencyTier } from '~/lib/game/urgency';

describe('urgencyTier', () => {
  const windowSeconds = 24 * 60 * 60; // 24h game

  it('is normal with most of the window left', () => {
    expect(urgencyTier(windowSeconds * 0.5, windowSeconds)).toBe('normal');
  });

  it('becomes warning at the same 20%-of-window threshold send_time_warnings uses', () => {
    expect(urgencyTier(windowSeconds * 0.2, windowSeconds)).toBe('warning');
    expect(urgencyTier(windowSeconds * 0.21, windowSeconds)).toBe('normal');
  });

  it('becomes critical very close to the deadline', () => {
    expect(urgencyTier(windowSeconds * 0.05, windowSeconds)).toBe('critical');
    expect(urgencyTier(windowSeconds * 0.06, windowSeconds)).toBe('warning');
  });

  it('is critical once the deadline has already passed (zero or negative remaining)', () => {
    expect(urgencyTier(0, windowSeconds)).toBe('critical');
    expect(urgencyTier(-10, windowSeconds)).toBe('critical');
  });

  it('scales with the window, not an absolute duration — the same fraction is equally urgent for a 1h and 24h game', () => {
    const oneHour = 60 * 60;
    expect(urgencyTier(oneHour * 0.1, oneHour)).toBe(
      urgencyTier(windowSeconds * 0.1, windowSeconds),
    );
  });
});
