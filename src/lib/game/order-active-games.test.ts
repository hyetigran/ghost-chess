import { orderActiveGames } from '~/lib/game/order-active-games';
import type { ActiveGame } from '~/types/database';

const viewerId = 'viewer-1';
const opponentId = 'opponent-1';

// Builds a minimal ActiveGame-shaped fixture — only the fields
// orderActiveGames actually reads are meaningful, the rest are filled
// with plausible placeholders so the type checks.
function game(overrides: Partial<ActiveGame> & { game_id: string }): ActiveGame {
  return {
    white_player_id: viewerId,
    black_player_id: opponentId,
    white_username: 'viewer',
    white_elo_rating: 1200,
    black_username: 'opponent',
    black_elo_rating: 1200,
    status: 'active',
    current_turn: 'white',
    time_control_hours: 24,
    redacted_fen: 'start',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('orderActiveGames', () => {
  it('puts your-turn games before waiting-on-opponent games', () => {
    const waiting = game({
      game_id: 'waiting-on-opponent',
      current_turn: 'black', // opponent (black) to move, viewer is white
    });
    const yourTurn = game({
      game_id: 'your-turn',
      current_turn: 'white', // viewer (white) to move
    });

    const result = orderActiveGames([waiting, yourTurn], viewerId);

    expect(result.map((g) => g.game_id)).toEqual(['your-turn', 'waiting-on-opponent']);
  });

  it('sorts your-turn games by soonest deadline first', () => {
    const plentyOfTime = game({
      game_id: 'plenty',
      current_turn: 'white',
      time_control_hours: 24,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    const almostDue = game({
      game_id: 'almost-due',
      current_turn: 'white',
      time_control_hours: 1,
      updated_at: '2026-01-01T00:50:00.000Z',
    });

    const now = new Date('2026-01-01T01:00:00.000Z');
    const result = orderActiveGames([plentyOfTime, almostDue], viewerId, now);

    expect(result.map((g) => g.game_id)).toEqual(['almost-due', 'plenty']);
  });

  it('sorts waiting-on-opponent games by soonest deadline first, independent of your-turn ordering', () => {
    const opponentPlentyOfTime = game({
      game_id: 'opponent-plenty',
      current_turn: 'black',
      time_control_hours: 24,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    const opponentAlmostDue = game({
      game_id: 'opponent-almost-due',
      current_turn: 'black',
      time_control_hours: 1,
      updated_at: '2026-01-01T00:50:00.000Z',
    });

    const now = new Date('2026-01-01T01:00:00.000Z');
    const result = orderActiveGames(
      [opponentPlentyOfTime, opponentAlmostDue],
      viewerId,
      now,
    );

    expect(result.map((g) => g.game_id)).toEqual([
      'opponent-almost-due',
      'opponent-plenty',
    ]);
  });

  it('excludes waiting (open-seat) games', () => {
    const openSeat = game({
      game_id: 'open-seat',
      status: 'waiting',
      white_player_id: viewerId,
      black_player_id: null,
    });
    const active = game({ game_id: 'active-game' });

    const result = orderActiveGames([openSeat, active], viewerId);

    expect(result.map((g) => g.game_id)).toEqual(['active-game']);
  });

  it('excludes finished (completed/abandoned) games', () => {
    const completed = game({ game_id: 'completed', status: 'completed' });
    const abandoned = game({ game_id: 'abandoned', status: 'abandoned' });
    const active = game({ game_id: 'active-game' });

    const result = orderActiveGames([completed, abandoned, active], viewerId);

    expect(result.map((g) => g.game_id)).toEqual(['active-game']);
  });

  it('returns an empty list when there are no active games', () => {
    expect(orderActiveGames([], viewerId)).toEqual([]);
  });
});
