import { squareAt } from '~/lib/game/board-geometry';

describe('squareAt', () => {
  it("renders a8 at the top-left and h1 at the bottom-right from white's perspective", () => {
    expect(squareAt(0, 0, 'white')).toBe('a8');
    expect(squareAt(0, 7, 'white')).toBe('h8');
    expect(squareAt(7, 0, 'white')).toBe('a1');
    expect(squareAt(7, 7, 'white')).toBe('h1');
  });

  it("mirrors both axes from black's perspective, so black's own back rank renders at the bottom", () => {
    expect(squareAt(0, 0, 'black')).toBe('h1');
    expect(squareAt(0, 7, 'black')).toBe('a1');
    expect(squareAt(7, 0, 'black')).toBe('h8');
    expect(squareAt(7, 7, 'black')).toBe('a8');
  });

  it('covers all 64 squares exactly once for each orientation', () => {
    for (const orientation of ['white', 'black'] as const) {
      const seen = new Set<string>();
      for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
          seen.add(squareAt(rank, file, orientation));
        }
      }
      expect(seen.size).toBe(64);
    }
  });
});
