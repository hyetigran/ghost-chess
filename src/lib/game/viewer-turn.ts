export function isViewersTurn(
  currentTurn: 'white' | 'black',
  whitePlayerId: string | null,
  viewerId: string,
): boolean {
  const viewerColor = whitePlayerId === viewerId ? 'white' : 'black';
  return currentTurn === viewerColor;
}
