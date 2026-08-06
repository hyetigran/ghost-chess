// Rules copy for the How to Play screen (#26, PRD §2.1/§2.2). Kept
// factually in lockstep with CONTEXT.md's Visibility/Move rejection/King
// capture glossary entries — this is player-facing prose, but it's making
// the same claims those entries formalize, so getting the nuance wrong
// here (e.g. implying vision works like the old all-or-nothing model, or
// that illegal moves ever hint at why) would actively mislead players
// about what the game does and doesn't hide.
export type HowToPlayEntry = {
  title: string;
  body: string;
};

// General chess literacy for total beginners — deliberately generic, not
// occlusion-specific (that's HOW_TO_PLAY_SECTIONS below). Deliberately
// says "capturing the king" rather than "checkmate" — this game has
// neither check nor checkmate (see HOW_TO_PLAY_SECTIONS' "When the game
// ends"), so teaching beginners the standard checkmate goal here would
// contradict what they're about to actually play.
export const CHESS_BASICS_TIPS: string[] = [
  'Two players take turns moving one piece at a time.',
  'Pawns move straight ahead but capture diagonally; other pieces each move in their own fixed pattern (rooks in straight lines, bishops diagonally, the knight in an L, the queen any direction, the king one square at a time).',
  "The goal is to capture your opponent's king.",
];

export const HOW_TO_PLAY_SECTIONS: HowToPlayEntry[] = [
  {
    title: 'The twist',
    body: "Ghost Chess plays by standard chess piece-movement rules, with one big change: you only see your own pieces plus whichever of your opponent's pieces your own pieces currently threaten. Everything else stays hidden — you're not just planning against a visible opponent, you're trying to remember and deduce where the rest of their pieces are.",
  },
  {
    title: 'What you can see',
    body: "Your own pieces, always. An opponent piece becomes visible the moment one of your pieces could capture it — a rook or bishop reveals a piece anywhere along its open line, a pawn only reveals what's on its two diagonal squares, a knight or king only its immediate reach. Move (or lose) the piece that was seeing it, and it goes dark again — nothing is remembered for you once it's out of reach, though you're free to remember it yourself. The squares you're legally allowed to move to are highlighted when you select a piece, including risky ones that would leave your own king exposed.",
  },
  {
    title: 'Captures',
    body: "When you capture an opponent's piece, it briefly appears before being removed from the board — that's the one moment you're guaranteed to see it, even if it was hidden right up until then. Captured pieces (yours and your opponent's) are also shown in the captured-pieces tray, so you always know material count even if you never saw a piece taken.",
  },
  {
    title: 'Illegal moves reveal nothing',
    body: 'If you try to move somewhere illegal — including onto a square you can\'t currently see — the move is simply rejected. There\'s no special feedback for "that square was actually occupied" versus any other illegal move. Probing squares to find hidden pieces doesn\'t work: every rejection looks and feels identical.',
  },
  {
    title: 'When the game ends',
    body: "There's no check or checkmate. A move that leaves your own king exposed is still legal — the game only ends the instant someone's king is actually captured (or by a draw, resignation, or a missed deadline). Once a game is over, occlusion lifts completely: both players can review the true final position and the full move history.",
  },
];

export const STRATEGY_TIPS: string[] = [
  "Keep a mental (or physical) map of every opponent piece you've ever seen and every square it occupied — the game doesn't remember for you once a piece moves out of your sight, only you do.",
  'Nobody warns you when your king is exposed — there\'s no check here. If you can\'t currently see what\'s aimed at your king, reason it out from the position: what could be sitting just out of view on an open line?',
  "Losing a piece to a capture you didn't see coming is information too: it tells you exactly where one opponent piece was, even though it's gone now.",
  "Probing an occupied-looking square costs you a turn for nothing — an illegal move never tells you why it failed, so don't rely on trial and error to find hidden pieces.",
];
