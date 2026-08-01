import { Chess } from 'chess.js';

// A redacted FEN structurally omits the opponent's king along with
// every other opponent piece (redact_fen, supabase/schemas/06_functions.sql)
// — it's never a "complete legal position" by chess.js's own definition,
// so the default strict validation throws ("Invalid FEN: missing black
// king") for any real active game with anything hidden, i.e. nearly
// always. Reading pieces and generating moves for the viewer's own
// pieces both still work correctly without that validation — this is
// the one place that knowledge lives; every redacted-FEN consumer should
// go through this rather than calling `new Chess(...)` directly.
export function chessFromRedactedFen(fen: string): Chess {
  return new Chess(fen, { skipValidation: true });
}
