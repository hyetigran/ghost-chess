import { z } from 'zod';
import { Chess } from 'chess.js';

// Base schemas
export const gameSettingsSchema = z.object({
  timeControl: z.number().int().positive(), // in minutes
  timeIncrement: z.number().int().nonnegative(), // in seconds
  isPrivate: z.boolean(),
  allowTakebacks: z.boolean(),
});

export const userSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1).max(50),
  email: z.string().email().nullable(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  draws: z.number().int().nonnegative(),
  elo_rating: z.number().int().min(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const gameSchema = z.object({
  id: z.string().uuid(),
  white_player_id: z.string().uuid(),
  black_player_id: z.string().uuid(),
  settings: gameSettingsSchema,
  status: z.enum(['active', 'completed', 'abandoned']),
  result: z.enum(['checkmate', 'stalemate', 'draw', 'abandoned']).nullable(),
  current_turn: z.enum(['white', 'black']),
  fen: z.string(),
  pgn: z.string().nullable(),
  white_time_remaining: z.number().int().nonnegative(),
  black_time_remaining: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const moveSchema = z.object({
  id: z.string().uuid(),
  game_id: z.string().uuid(),
  player_id: z.string().uuid(),
  move_number: z.number().int().positive(),
  move_text: z.string(),
  fen: z.string(),
  captured_piece: z.string().nullable(),
  created_at: z.string().datetime(),
});

// Response schemas
export const databaseResponseSchema = <T extends z.ZodType>(schema: T) =>
  z.object({
    data: schema.nullable(),
    error: z.instanceof(Error).nullable(),
  });

// Derived types
export type User = z.infer<typeof userSchema>;
export type GameSettings = z.infer<typeof gameSettingsSchema>;
export type Game = z.infer<typeof gameSchema>;
export type Move = z.infer<typeof moveSchema>;

// Response types
export type DatabaseResponse<T> = {
  data: T | null;
  error: Error | null;
};

// Query response types
export type UserProfileResponse = DatabaseResponse<User>;
export type UserStatsResponse = DatabaseResponse<
  Pick<User, 'wins' | 'losses' | 'draws' | 'elo_rating'>
>;

// Game response types
export type ActiveGame = Pick<
  Game,
  | 'id'
  | 'white_player_id'
  | 'black_player_id'
  | 'status'
  | 'current_turn'
  | 'fen'
  | 'white_time_remaining'
  | 'black_time_remaining'
  | 'created_at'
>;

export type GameHistory = Pick<
  Game,
  | 'id'
  | 'white_player_id'
  | 'black_player_id'
  | 'status'
  | 'result'
  | 'pgn'
  | 'created_at'
>;

export type LeaderboardUser = Pick<
  User,
  'id' | 'username' | 'elo_rating' | 'wins' | 'losses' | 'draws'
>;

export type Opponent = Pick<User, 'id' | 'username' | 'elo_rating'>;

// Response types
export type ActiveGamesResponse = DatabaseResponse<ActiveGame[]>;
export type GameHistoryResponse = DatabaseResponse<GameHistory[]>;
export type LeaderboardResponse = DatabaseResponse<LeaderboardUser[]>;
export type OpponentResponse = DatabaseResponse<Opponent>;

export type GameState = {
  chess: Chess;
  lastMoveTime: number;
  white_time_remaining: number;
  black_time_remaining: number;
};

export type GameResult = 'checkmate' | 'stalemate' | 'draw' | 'abandoned';

// Schema exports
export const activeGameSchema = gameSchema.pick({
  id: true,
  white_player_id: true,
  black_player_id: true,
  status: true,
  current_turn: true,
  fen: true,
  white_time_remaining: true,
  black_time_remaining: true,
  created_at: true,
});

export const gameHistorySchema = gameSchema.pick({
  id: true,
  white_player_id: true,
  black_player_id: true,
  status: true,
  result: true,
  pgn: true,
  created_at: true,
});

export const leaderboardUserSchema = userSchema.pick({
  id: true,
  username: true,
  elo_rating: true,
  wins: true,
  losses: true,
  draws: true,
});

export const opponentSchema = userSchema.pick({
  id: true,
  username: true,
  elo_rating: true,
});
