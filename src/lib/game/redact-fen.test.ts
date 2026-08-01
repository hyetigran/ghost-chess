import { redactFen } from './redact-fen';

describe('redactFen', () => {
  it('hides every opponent piece and keeps every own piece at the start position', () => {
    const startFen =
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    expect(redactFen(startFen, 'white')).toBe(
      '8/8/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1',
    );
    expect(redactFen(startFen, 'black')).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/8/8 w kq - 0 1',
    );
  });

  it('keeps own pieces visible on an otherwise-hidden rank', () => {
    // 1. e4 - white pawn advanced to e4
    const afterE4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

    expect(redactFen(afterE4, 'white')).toBe(
      '8/8/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQ - 0 1',
    );
  });

  it('hides an opponent piece and merges the surrounding empty squares', () => {
    const black = redactFen(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      'black',
    );

    expect(black).toBe('rnbqkbnr/pppppppp/8/8/8/8/8/8 b kq - 0 1');
  });

  it('collapses two separate own-piece runs around a hidden opponent piece', () => {
    // Contrived rank: white rook, black pawn, white rook, 5 empty squares.
    const fen = 'RpR5/8/8/8/8/8/8/8 w - - 0 1';

    expect(redactFen(fen, 'white')).toBe('R1R5/8/8/8/8/8/8/8 w - - 0 1');
  });

  it('drops the opponent half of castling rights', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';

    expect(redactFen(fen, 'white')).toBe(
      '8/8/8/8/8/8/8/R3K2R w KQ - 0 1',
    );
    expect(redactFen(fen, 'black')).toBe(
      'r3k2r/8/8/8/8/8/8/8 w kq - 0 1',
    );
  });

  it('always hides the en passant target square, regardless of viewer', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';

    expect(redactFen(fen, 'white')).not.toContain('d6');
    expect(redactFen(fen, 'black')).not.toContain('d6');
  });

  it('passes through active color, halfmove clock, and fullmove number unchanged', () => {
    const fen = '8/8/8/8/8/8/8/8 b - - 12 34';

    expect(redactFen(fen, 'white')).toBe('8/8/8/8/8/8/8/8 b - - 12 34');
  });

  it('renders an empty board with no castling rights as all dashes', () => {
    const fen = '8/8/8/8/8/8/8/8 w - - 0 1';

    expect(redactFen(fen, 'white')).toBe('8/8/8/8/8/8/8/8 w - - 0 1');
  });

  it('rejects a viewer color that is neither white nor black', () => {
    const fen = '8/8/8/8/8/8/8/8 w - - 0 1';

    // @ts-expect-error - deliberately invalid input
    expect(() => redactFen(fen, 'red')).toThrow();
  });
});
