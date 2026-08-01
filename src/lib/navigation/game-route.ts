import type { Href } from 'expo-router';

export function gameRoute(gameId: string): Href {
  return { pathname: '/(game)/[id]/page', params: { id: gameId } };
}
