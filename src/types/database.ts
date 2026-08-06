import { z } from 'zod';

// Base schemas
//
// timeControlHours is the per-move deadline (docs/adr/0006): a fresh
// window of exactly this many hours opens the instant it becomes a
// player's turn, not a cumulative game clock. There is no increment —
// that's a classical-clock concept with nothing to attach to here.
export const gameSettingsSchema = z.object({
  timeControlHours: z.union([z.literal(1), z.literal(12), z.literal(24)]),
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

// 'timeout' is a forfeit on a lapsed per-move deadline (docs/adr/0006);
// 'abandoned' is resignation. Deliberately distinct rather than reused —
// see CONTEXT.md's Forfeit entry for why conflating them was a real bug
// (the ELO trigger inferred the loser from whose turn it was for both,
// which is only correct for a timeout).
export const gameResultSchema = z
  .enum(['checkmate', 'stalemate', 'draw', 'abandoned', 'timeout'])
  .nullable();

export const gameSchema = z.object({
  id: z.string().uuid(),
  white_player_id: z.string().uuid().nullable(),
  black_player_id: z.string().uuid().nullable(),
  settings: gameSettingsSchema,
  status: z.enum(['waiting', 'active', 'completed', 'abandoned']),
  result: gameResultSchema,
  winner_id: z.string().uuid().nullable(),
  current_turn: z.enum(['white', 'black']),
  fen: z.string(),
  pgn: z.string().nullable(),
  is_check: z.boolean(),
  // Open-invitation rating gate (#33) — both null means "open to
  // anyone," the case for every private-link game and every open
  // invitation that didn't turn on "my rating class only".
  invitation_min_rating: z.number().int().nullable(),
  invitation_max_rating: z.number().int().nullable(),
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

// Redacted, per-player view of a game — the only game-state shape a client
// should ever read while a game is active. See docs/adr/0001, docs/adr/0002,
// and ARCHITECTURE.md's "Data flow" section.
export const playerViewSchema = z.object({
  game_id: z.string().uuid(),
  player_id: z.string().uuid(),
  white_player_id: z.string().uuid().nullable(),
  black_player_id: z.string().uuid().nullable(),
  // Same "not secret" reasoning as white_player_id/black_player_id above —
  // denormalized so the client never needs a direct public.users read
  // (RLS there is own-row-only) to show a player card for the opponent.
  white_username: z.string().nullable(),
  white_elo_rating: z.number().int().nullable(),
  black_username: z.string().nullable(),
  black_elo_rating: z.number().int().nullable(),
  redacted_fen: z.string(),
  current_turn: z.enum(['white', 'black']),
  status: z.enum(['waiting', 'active', 'completed', 'abandoned']),
  result: gameResultSchema,
  // Denormalized from games.winner_id — not secret (who won is never
  // hidden information, only the in-progress position is), needed for
  // the post-game "you won"/"you lost" summary (#19).
  winner_id: z.string().uuid().nullable(),
  // Denormalized from games.settings.timeControlHours (not secret — a
  // game's time control is visible to both players by definition) so the
  // client can compute the current deadline (src/lib/game/deadline.ts)
  // from this plus updated_at/current_turn, without ever reading
  // public.games directly.
  time_control_hours: z.union([z.literal(1), z.literal(12), z.literal(24)]),
  is_check: z.boolean(),
  captured_by_white: z.array(z.string()),
  captured_by_black: z.array(z.string()),
  updated_at: z.string().datetime(),
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
export type PlayerView = z.infer<typeof playerViewSchema>;

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
//
// Sourced from player_views, not games directly — a games-listing read for
// "your active games" is a legitimate need (PRD's home/dashboard "recent
// games"), but games' SELECT RLS denies active-status rows entirely (#12),
// and even if it didn't, this shape must never carry the true fen. Uses
// game_id (player_views' key) rather than id, and updated_at rather than
// created_at (player_views has no created_at; "most recently active" is
// arguably the more useful ordering for this list anyway).
export type ActiveGame = Pick<
  PlayerView,
  | 'game_id'
  | 'white_player_id'
  | 'black_player_id'
  | 'white_username'
  | 'white_elo_rating'
  | 'black_username'
  | 'black_elo_rating'
  | 'status'
  | 'current_turn'
  | 'time_control_hours'
  | 'redacted_fen'
  | 'updated_at'
>;

export type GameHistory = Pick<
  Game,
  | 'id'
  | 'white_player_id'
  | 'black_player_id'
  | 'status'
  | 'result'
  | 'winner_id'
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

export type GameResult = z.infer<typeof gameResultSchema>;

// Schema exports
export const activeGameSchema = playerViewSchema.pick({
  game_id: true,
  white_player_id: true,
  black_player_id: true,
  white_username: true,
  white_elo_rating: true,
  black_username: true,
  black_elo_rating: true,
  status: true,
  current_turn: true,
  time_control_hours: true,
  redacted_fen: true,
  updated_at: true,
});

export const gameHistorySchema = gameSchema.pick({
  id: true,
  white_player_id: true,
  black_player_id: true,
  status: true,
  result: true,
  winner_id: true,
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

// Open invitations (#33) — shapes returned by the get_open_invitations()/
// get_my_open_invitations() RPCs (supabase/schemas/08_functions.sql), not
// picked from gameSchema/playerViewSchema: these are security-definer
// functions that join in the poster's identity from public.users (whose
// own RLS is own-row-only, so a client can't do that join itself), and
// return exactly the fields the browse UI needs rather than a full games
// row.
export const openInvitationSchema = z.object({
  id: z.string().uuid(),
  creator_id: z.string().uuid(),
  creator_username: z.string(),
  creator_elo_rating: z.number().int(),
  creator_color: z.enum(['white', 'black']),
  settings: gameSettingsSchema,
  invitation_min_rating: z.number().int().nullable(),
  invitation_max_rating: z.number().int().nullable(),
  created_at: z.string().datetime(),
});

export const myOpenInvitationSchema = z.object({
  id: z.string().uuid(),
  settings: gameSettingsSchema,
  invitation_min_rating: z.number().int().nullable(),
  invitation_max_rating: z.number().int().nullable(),
  created_at: z.string().datetime(),
});

export type OpenInvitation = z.infer<typeof openInvitationSchema>;
export type MyOpenInvitation = z.infer<typeof myOpenInvitationSchema>;
