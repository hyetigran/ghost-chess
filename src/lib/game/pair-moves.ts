import type { Color } from '~/lib/game/local-move';

export type MoveEntry = { san: string; color: Color };
export type MoveRow = { number: number; white?: string; black?: string };

// Pairs a flat, chronological move list into numbered White/Black rows for
// display (standard PGN-style layout: "1. e4 e5"). Handles a game that
// currently starts mid-sequence on Black (a lone black entry with no
// preceding white one) by opening a number-less-paired row rather than
// throwing, since a real move list is never truly malformed — it just
// reflects whatever moves have happened so far.
export function pairMoves(entries: MoveEntry[]): MoveRow[] {
  const rows: MoveRow[] = [];

  for (const entry of entries) {
    const last = rows[rows.length - 1];

    if (entry.color === 'white') {
      rows.push({ number: rows.length + 1, white: entry.san });
    } else if (last && last.black === undefined) {
      last.black = entry.san;
    } else {
      rows.push({ number: rows.length + 1, black: entry.san });
    }
  }

  return rows;
}
