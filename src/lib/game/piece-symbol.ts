const SYMBOLS = {
  p: '♟',
  n: '♞',
  b: '♝',
  r: '♜',
  q: '♛',
  k: '♚',
} as const;

export function pieceSymbol(piece: {
  type: string;
  color: string;
}): string | undefined {
  const symbol = SYMBOLS[piece.type as keyof typeof SYMBOLS];
  return piece.color === 'w' ? symbol : symbol?.toLowerCase();
}
