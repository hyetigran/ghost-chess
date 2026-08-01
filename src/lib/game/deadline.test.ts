import { deadlineFor, isDeadlineLapsed, secondsUntilDeadline } from '~/lib/game/deadline';

describe('deadlineFor', () => {
  it('adds the time control window in hours to the turn-start timestamp', () => {
    const turnStarted = '2026-01-01T00:00:00.000Z';
    expect(deadlineFor(turnStarted, 1).toISOString()).toBe(
      '2026-01-01T01:00:00.000Z',
    );
    expect(deadlineFor(turnStarted, 12).toISOString()).toBe(
      '2026-01-01T12:00:00.000Z',
    );
    expect(deadlineFor(turnStarted, 24).toISOString()).toBe(
      '2026-01-02T00:00:00.000Z',
    );
  });
});

describe('isDeadlineLapsed', () => {
  const turnStarted = '2026-01-01T00:00:00.000Z';

  it('is not lapsed before the deadline', () => {
    const justBefore = new Date('2026-01-01T00:59:59.000Z');
    expect(isDeadlineLapsed(turnStarted, 1, justBefore)).toBe(false);
  });

  it('is lapsed exactly at the deadline', () => {
    const exactly = new Date('2026-01-01T01:00:00.000Z');
    expect(isDeadlineLapsed(turnStarted, 1, exactly)).toBe(true);
  });

  it('is lapsed after the deadline', () => {
    const after = new Date('2026-01-01T02:00:00.000Z');
    expect(isDeadlineLapsed(turnStarted, 1, after)).toBe(true);
  });

  it('defaults to the current time when no reference is given', () => {
    const longAgo = '2000-01-01T00:00:00.000Z';
    expect(isDeadlineLapsed(longAgo, 1)).toBe(true);

    const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10).toISOString();
    expect(isDeadlineLapsed(farFuture, 24)).toBe(false);
  });
});

describe('secondsUntilDeadline', () => {
  const turnStarted = '2026-01-01T00:00:00.000Z';

  it('counts down the full window right at turn start', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(secondsUntilDeadline(turnStarted, 1, now)).toBe(3600);
  });

  it('counts down partway through the window', () => {
    const now = new Date('2026-01-01T00:30:00.000Z');
    expect(secondsUntilDeadline(turnStarted, 1, now)).toBe(1800);
  });

  it('never goes negative once the deadline has passed', () => {
    const now = new Date('2026-01-01T02:00:00.000Z');
    expect(secondsUntilDeadline(turnStarted, 1, now)).toBe(0);
  });
});
