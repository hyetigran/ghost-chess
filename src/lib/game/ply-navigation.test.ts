import { stepViewingPly } from '~/lib/game/ply-navigation';

describe('stepViewingPly', () => {
  it('steps from live to the last ply on prev', () => {
    expect(stepViewingPly(null, 5, 'prev')).toBe(4);
  });

  it('no-ops on next while already live', () => {
    expect(stepViewingPly(null, 5, 'next')).toBe(null);
  });

  it('steps backward through history', () => {
    expect(stepViewingPly(2, 5, 'prev')).toBe(1);
  });

  it('steps forward through history', () => {
    expect(stepViewingPly(2, 5, 'next')).toBe(3);
  });

  it('clamps (no-ops) at the earliest ply on prev', () => {
    expect(stepViewingPly(0, 5, 'prev')).toBe(0);
  });

  it('advances to live once next steps past the last ply', () => {
    expect(stepViewingPly(4, 5, 'next')).toBe(null);
  });

  it('no-ops in every direction when there are no moves at all', () => {
    expect(stepViewingPly(null, 0, 'prev')).toBe(null);
    expect(stepViewingPly(null, 0, 'next')).toBe(null);
  });
});
