import { Chess } from 'chess.js';

export type GameMode = 'local' | 'online' | 'ai';

export type GameStatus =
  | 'waiting'
  | 'active'
  | 'paused'
  | 'completed'
  | 'abandoned';

export type GameResult = 'white-wins' | 'black-wins' | 'draw' | 'abandoned';

export type PlayerColor = 'white' | 'black';

export type TimeControl = {
  type: 'classical' | 'rapid' | 'blitz' | 'bullet';
  initialTime: number; // in seconds
  increment: number; // in seconds
};

export type GameSettings = {
  mode: GameMode;
  timeControl: TimeControl;
  isPrivate: boolean;
  allowTakebacks: boolean;
};

export type Player = {
  id: string;
  username: string;
  rating?: number;
  color: PlayerColor;
};

export type GameState = {
  id: string;
  fen: string;
  pgn: string;
  status: GameStatus;
  result?: GameResult;
  players: {
    white: Player;
    black: Player;
  };
  currentTurn: PlayerColor;
  lastMove?: string;
  capturedPieces: {
    white: string[];
    black: string[];
  };
  timeRemaining: {
    white: number;
    black: number;
  };
  settings: GameSettings;
  createdAt: string;
  updatedAt: string;
};

export type Move = {
  from: string;
  to: string;
  piece: string;
  captured?: string;
  san: string;
  timestamp: number;
};

export type GameStore = {
  currentGame: GameState | null;
  chessInstance: Chess | null;
  isLoading: boolean;
  error: string | null;
  setGame: (game: GameState) => void;
  makeMove: (move: Move) => void;
  abandonGame: (abandoningPlayerColor: PlayerColor) => void;
  resetGame: () => void;
  setError: (error: string | null) => void;
  setLoading: (isLoading: boolean) => void;
};
