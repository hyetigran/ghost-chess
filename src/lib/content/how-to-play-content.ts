// Rules copy for the How to Play screen (#26, PRD §2.1/§2.2). Kept
// factually in lockstep with CONTEXT.md's Visibility/Move rejection
// glossary entries — this is player-facing prose, but it's making the same
// claims those entries formalize, so getting the nuance wrong here (e.g.
// implying check announcements are a general information leak, or that
// illegal moves ever hint at why) would actively mislead players about
// what the game does and doesn't hide.
export type HowToPlaySection = {
  title: string;
  body: string;
};

export const HOW_TO_PLAY_SECTIONS: HowToPlaySection[] = [
  {
    title: 'The twist',
    body: 'Ghost Chess plays by standard chess rules, with one change: you can only see your own pieces. Your opponent\'s pieces are invisible the entire game — you\'re not just planning against a visible opponent, you\'re trying to remember and deduce where their pieces are.',
  },
  {
    title: 'What you can see',
    body: 'Your own pieces, always. The squares you\'re legally allowed to move to are highlighted when you select a piece. Everything about your opponent\'s pieces — position, movement, captures they make — is hidden until the moment it affects you directly.',
  },
  {
    title: 'Captures',
    body: 'When you capture an opponent\'s piece, it briefly appears before being removed from the board — that\'s the one moment you get to see it. Captured pieces (yours and your opponent\'s) are also shown in the captured-pieces tray, so you always know material count even if you never saw a piece taken.',
  },
  {
    title: 'Illegal moves reveal nothing',
    body: 'If you try to move somewhere illegal — including onto a square secretly occupied by a hidden opponent piece — the move is simply rejected. There\'s no special feedback for "that square was actually occupied" versus any other illegal move. Probing squares to find hidden pieces doesn\'t work: every rejection looks and feels identical.',
  },
  {
    title: 'Check is announced, but that\'s all',
    body: 'If your king is in check, you\'re told — the same as in standard chess. That much is safety information about your own king, not a leak about your opponent\'s board: it tells you *that* something is attacking your king, never *what* or *where*. Move rejection stays uninformative even during check.',
  },
  {
    title: 'When the game ends',
    body: 'Once a game is over — checkmate, stalemate, draw, resignation, or a missed deadline — occlusion lifts completely. Both players can review the true final position and the full move history.',
  },
];

export const STRATEGY_TIPS: string[] = [
  'Keep a mental (or physical) map of every opponent move you\'ve seen and every square that was ever occupied — occlusion doesn\'t reset your memory, only your sight.',
  'A check tells you an opponent piece has a clear line to your king right now — use the geometry of your own position to narrow down what it could be and where.',
  'Losing a piece to a capture you didn\'t see coming is information too: it tells you exactly where one opponent piece was, even though it\'s gone now.',
  'Probing an occupied-looking square costs you a turn for nothing — an illegal move never tells you why it failed, so don\'t rely on trial and error to find hidden pieces.',
];
