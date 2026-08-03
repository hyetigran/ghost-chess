import { fileLabels, rankLabels, squareAt } from '~/lib/game/board-geometry';

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

describe('fileLabels', () => {
  it('runs a-h left to right for white', () => {
    expect(fileLabels('white')).toEqual([
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h',
    ]);
  });

  it('runs h-a left to right for black, matching squareAt\'s mirror', () => {
    expect(fileLabels('black')).toEqual([
      'h', 'g', 'f', 'e', 'd', 'c', 'b', 'a',
    ]);
  });
});

describe('rankLabels', () => {
  it('runs 8-1 top to bottom for white', () => {
    expect(rankLabels('white')).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('runs 1-8 top to bottom for black, matching squareAt\'s mirror', () => {
    expect(rankLabels('black')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
