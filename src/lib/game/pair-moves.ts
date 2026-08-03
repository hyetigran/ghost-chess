import type { Color } from '~/lib/game/local-move';

export type MoveEntry = { san: string; color: Color; fen: string };
/** ply is this move's 0-based index in the original chronological list — the
 * stable identifier MoveHistory reports back on selection, since row/color
 * position alone doesn't uniquely address a move. */
export type MoveCell = { san: string; fen: string; ply: number };
export type MoveRow = { number: number; white?: MoveCell; black?: MoveCell };

// Pairs a flat, chronological move list into numbered White/Black rows for
// display (standard PGN-style layout: "1. e4 e5"). Handles a game that
// currently starts mid-sequence on Black (a lone black entry with no
// preceding white one) by opening a number-less-paired row rather than
// throwing, since a real move list is never truly malformed — it just
// reflects whatever moves have happened so far.
export function pairMoves(entries: MoveEntry[]): MoveRow[] {
  const rows: MoveRow[] = [];

  entries.forEach((entry, ply) => {
    const last = rows[rows.length - 1];
    const cell: MoveCell = { san: entry.san, fen: entry.fen, ply };

    if (entry.color === 'white') {
      rows.push({ number: rows.length + 1, white: cell });
    } else if (last && last.black === undefined) {
      last.black = cell;
    } else {
      rows.push({ number: rows.length + 1, black: cell });
    }
  });

  return rows;
}
