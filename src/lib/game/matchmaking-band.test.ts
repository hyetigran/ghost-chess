import { matchmakingBand } from '~/lib/game/matchmaking-band';

describe('matchmakingBand', () => {
  it('starts at the base band for a fresh join', () => {
    expect(matchmakingBand(0)).toBe(100);
  });

  it('widens by 50 every 15 seconds waited', () => {
    expect(matchmakingBand(14)).toBe(100);
    expect(matchmakingBand(15)).toBe(150);
    expect(matchmakingBand(29)).toBe(150);
    expect(matchmakingBand(30)).toBe(200);
  });

  it('keeps widening indefinitely, uncapped', () => {
    expect(matchmakingBand(300)).toBe(1100);
  });

  it('treats a negative wait as zero', () => {
    expect(matchmakingBand(-10)).toBe(100);
  });
});
