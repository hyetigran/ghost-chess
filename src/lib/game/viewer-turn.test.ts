import { isViewersTurn } from '~/lib/game/viewer-turn';

describe('isViewersTurn', () => {
  it('is true for the white viewer when it is white to move', () => {
    expect(isViewersTurn('white', 'viewer-1', 'viewer-1')).toBe(true);
  });

  it('is false for the white viewer when it is black to move', () => {
    expect(isViewersTurn('black', 'viewer-1', 'viewer-1')).toBe(false);
  });

  it('is true for the black viewer when it is black to move', () => {
    expect(isViewersTurn('black', 'opponent-1', 'viewer-1')).toBe(true);
  });

  it('is false for the black viewer when it is white to move', () => {
    expect(isViewersTurn('white', 'opponent-1', 'viewer-1')).toBe(false);
  });
});
