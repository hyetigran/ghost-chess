import { isApproachingDeadline } from '~/lib/notifications/deadline-warning';

describe('isApproachingDeadline', () => {
  it('is false with most of the window still remaining', () => {
    const deadline = new Date('2026-01-01T12:00:00.000Z');
    const now = new Date('2026-01-01T02:00:00.000Z'); // 10h of 12h left
    expect(isApproachingDeadline(deadline, now, 12)).toBe(false);
  });

  it('is true once inside the warning fraction of the window (default 20%)', () => {
    const deadline = new Date('2026-01-01T12:00:00.000Z');
    const now = new Date('2026-01-01T10:00:00.000Z'); // 2h of 12h left = ~16.7%
    expect(isApproachingDeadline(deadline, now, 12)).toBe(true);
  });

  it("is false once the deadline has already passed — that is forfeit_lapsed_games' job, not a warning", () => {
    const deadline = new Date('2026-01-01T12:00:00.000Z');
    const now = new Date('2026-01-01T13:00:00.000Z');
    expect(isApproachingDeadline(deadline, now, 12)).toBe(false);
  });

  it('scales the warning window with the time control — 20% of 1 hour is much smaller than 20% of 24 hours', () => {
    // 60 minutes remaining: outside the window for a 1h control (20% of
    // 1h = 12min), but well inside it for a 24h control (20% of 24h =
    // 4.8h = 288min) — the same absolute remaining time, opposite verdicts.
    const deadline1h = new Date('2026-01-01T01:00:00.000Z');
    const sixtyMinutesLeft1h = new Date('2026-01-01T00:00:00.000Z');
    expect(isApproachingDeadline(deadline1h, sixtyMinutesLeft1h, 1)).toBe(
      false,
    );

    const deadline24h = new Date('2026-01-02T00:00:00.000Z');
    const sixtyMinutesLeft24h = new Date('2026-01-01T23:00:00.000Z');
    expect(isApproachingDeadline(deadline24h, sixtyMinutesLeft24h, 24)).toBe(
      true,
    );
  });

  it('respects a custom warning fraction', () => {
    const deadline = new Date('2026-01-01T12:00:00.000Z');
    const now = new Date('2026-01-01T06:30:00.000Z'); // half the window left
    expect(isApproachingDeadline(deadline, now, 12, 0.5)).toBe(true);
    expect(isApproachingDeadline(deadline, now, 12, 0.4)).toBe(false);
  });
});
