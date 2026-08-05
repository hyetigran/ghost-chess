// Rules copy for the How to Play screen (#26, PRD §2.1/§2.2). Kept
// factually in lockstep with CONTEXT.md's Visibility/Move rejection
// glossary entries — this is player-facing prose, but it's making the same
// claims those entries formalize, so getting the nuance wrong here (e.g.
// implying check announcements are a general information leak, or that
// illegal moves ever hint at why) would actively mislead players about
// what the game does and doesn't hide.
export type HowToPlayEntry = {
  title: string;
  body: string;
};

// General chess literacy for total beginners — deliberately generic, not
// occlusion-specific (that's HOW_TO_PLAY_SECTIONS below).
export const CHESS_BASICS_TIPS: string[] = [
  'Two players take turns moving one piece at a time.',
  'Pawns move straight ahead but capture diagonally; other pieces each move in their own fixed pattern (rooks in straight lines, bishops diagonally, the knight in an L, the queen any direction, the king one square at a time).',
  "The goal is checkmate: trapping your opponent's king so it can't escape capture.",
];

export const HOW_TO_PLAY_SECTIONS: HowToPlayEntry[] = [
  {
    title: 'The twist',
    body: "Ghost Chess plays by standard chess rules, with one change: you can only see your own pieces. Your opponent's pieces are invisible the entire game — you're not just planning against a visible opponent, you're trying to remember and deduce where their pieces are.",
  },
  {
    title: 'What you can see',
    body: "Your own pieces, always. The squares you're legally allowed to move to are highlighted when you select a piece. Your opponent's pieces stay hidden the whole game, with one exception: a piece you capture appears briefly (see Captures below). If the opponent captures one of yours, you'll see your own piece vanish — the piece that took it stays hidden.",
  },
  {
    title: 'Captures',
    body: "When you capture an opponent's piece, it briefly appears before being removed from the board — that's the one moment you get to see it. Captured pieces (yours and your opponent's) are also shown in the captured-pieces tray, so you always know material count even if you never saw a piece taken.",
  },
  {
    title: 'Illegal moves reveal nothing',
    body: 'If you try to move somewhere illegal — including onto a square secretly occupied by a hidden opponent piece — the move is simply rejected. There\'s no special feedback for "that square was actually occupied" versus any other illegal move. Probing squares to find hidden pieces doesn\'t work: every rejection looks and feels identical.',
  },
  {
    title: "Check is announced, but that's all",
    body: "If your king is in check, you're told — the same as in standard chess. That much is safety information about your own king, not a leak about your opponent's board: it tells you *that* something is attacking your king, never *what* or *where*. Move rejection stays uninformative even during check.",
  },
  {
    title: 'When the game ends',
    body: 'Once a game is over — checkmate, stalemate, draw, resignation, or a missed deadline — occlusion lifts completely. Both players can review the true final position and the full move history.',
  },
];

export const STRATEGY_TIPS: string[] = [
  "Keep a mental (or physical) map of every opponent move you've seen and every square that was ever occupied — occlusion doesn't reset your memory, only your sight.",
  "A check announcement only tells you *that* your king is attacked, never which piece or from where — but you can still reason it out yourself from your own king's position and what lines are open to it.",
  "Losing a piece to a capture you didn't see coming is information too: it tells you exactly where one opponent piece was, even though it's gone now.",
  "Probing an occupied-looking square costs you a turn for nothing — an illegal move never tells you why it failed, so don't rely on trial and error to find hidden pieces.",
];
