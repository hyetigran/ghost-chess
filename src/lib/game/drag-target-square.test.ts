import { dragTargetSquare } from '~/lib/game/drag-target-square';

const SQUARE_SIZE = 70;

describe('dragTargetSquare', () => {
  it('returns the same square when there is no movement', () => {
    expect(dragTargetSquare(3, 3, 0, 0, SQUARE_SIZE, 'white')).toBe('d5');
  });

  it('moves one square in each screen direction (white orientation)', () => {
    // White: displayFile 0..7 is a..h (left to right), displayRank 0..7
    // is rank 8..1 (top to bottom) — dragging right increases the file
    // letter, dragging down decreases the rank number.
    expect(dragTargetSquare(3, 3, SQUARE_SIZE, 0, SQUARE_SIZE, 'white')).toBe(
      'e5',
    );
    expect(dragTargetSquare(3, 3, -SQUARE_SIZE, 0, SQUARE_SIZE, 'white')).toBe(
      'c5',
    );
    expect(dragTargetSquare(3, 3, 0, SQUARE_SIZE, SQUARE_SIZE, 'white')).toBe(
      'd4',
    );
    expect(dragTargetSquare(3, 3, 0, -SQUARE_SIZE, SQUARE_SIZE, 'white')).toBe(
      'd6',
    );
  });

  it('mirrors correctly for black orientation without any special-casing', () => {
    // Black: displayFile 0..7 is h..a (left to right), so the same
    // rightward screen drag now *decreases* the file letter.
    expect(dragTargetSquare(3, 3, SQUARE_SIZE, 0, SQUARE_SIZE, 'black')).toBe(
      'd4',
    );
    expect(dragTargetSquare(3, 3, -SQUARE_SIZE, 0, SQUARE_SIZE, 'black')).toBe(
      'f4',
    );
  });

  it('clamps to the edge of the board rather than going off it', () => {
    // Already on the h-file (displayFile 7, white) — dragging further
    // right stays on h.
    expect(
      dragTargetSquare(3, 7, SQUARE_SIZE * 3, 0, SQUARE_SIZE, 'white'),
    ).toBe('h5');
    // Already on rank 8 (displayRank 0, white) — dragging further up
    // stays on rank 8.
    expect(
      dragTargetSquare(0, 3, 0, -SQUARE_SIZE * 3, SQUARE_SIZE, 'white'),
    ).toBe('d8');
  });

  it('rounds to the nearest square rather than requiring an exact drag', () => {
    expect(
      dragTargetSquare(3, 3, SQUARE_SIZE * 0.4, 0, SQUARE_SIZE, 'white'),
    ).toBe('d5'); // rounds down, stays put
    expect(
      dragTargetSquare(3, 3, SQUARE_SIZE * 0.6, 0, SQUARE_SIZE, 'white'),
    ).toBe('e5'); // rounds up, moves one square
  });
});
