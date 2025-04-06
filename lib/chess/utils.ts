import { Chess } from 'chess.js';
import type { GameSettings, TimeControl } from '~/types/game';

export function createInitialGameState(settings: GameSettings) {
  const chess = new Chess();
  return {
    id: crypto.randomUUID(),
    fen: chess.fen(),
    pgn: chess.pgn(),
    status: 'waiting' as const,
    players: {
      white: {
        id: '',
        username: '',
        color: 'white' as const,
      },
      black: {
        id: '',
        username: '',
        color: 'black' as const,
      },
    },
    currentTurn: 'white' as const,
    capturedPieces: {
      white: [],
      black: [],
    },
    timeRemaining: {
      white: settings.timeControl.initialTime,
      black: settings.timeControl.initialTime,
    },
    settings,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getTimeControlLabel(timeControl: TimeControl): string {
  const minutes = timeControl.initialTime / 60;
  const increment = timeControl.increment;
  return `${minutes}+${increment}`;
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function isLegalMove(chess: Chess, from: string, to: string): boolean {
  try {
    const move = chess.move({
      from,
      to,
      promotion: 'q', // Default to queen promotion
    });
    return move !== null;
  } catch {
    return false;
  }
}
