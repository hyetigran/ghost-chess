// General chess literacy (#27's "quick-start guide for chess beginners")
// — deliberately generic, not occlusion-specific. The invisible-chess
// twist itself is CHESS_BASICS_TIPS below, and the exhaustive rules live
// in src/lib/content/how-to-play-content.ts (#26); this is neither.
export const CHESS_BASICS_TIPS: string[] = [
  'Two players take turns moving one piece at a time.',
  'Pawns move straight ahead but capture diagonally; other pieces each move in their own fixed pattern (rooks in straight lines, bishops diagonally, the knight in an L, the queen any direction, the king one square at a time).',
  "The goal is checkmate: trapping your opponent's king so it can't escape capture.",
];

export const OCCLUSION_TIPS: string[] = [
  'You always see your own pieces — your opponent never does either.',
  'A capture briefly reveals the piece taken before it disappears.',
  "If you're in check, you're told — but never which piece is delivering it.",
  'Try Local Play or vs. AI first if you want to practice before an online match.',
];
