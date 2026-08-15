import { gameUrgencyTier } from '~/lib/game/game-urgency';

const viewerId = 'viewer-1';
const opponentId = 'opponent-1';

describe('gameUrgencyTier', () => {
  it('is normal when it is not the viewers turn, regardless of time left', () => {
    // Opponent (black) to move, viewer plays white — the deadline shown
    // is the opponent's clock, not something the viewer needs to act on.
    const now = new Date('2026-01-01T00:59:59.000Z');
    const tier = gameUrgencyTier(
      {
        current_turn: 'black',
        white_player_id: viewerId,
        updated_at: '2026-01-01T00:00:00.000Z',
        time_control_hours: 1,
      },
      viewerId,
      now,
    );
    expect(tier).toBe('normal');
  });

  it('is critical when it is the viewers turn and the deadline is imminent', () => {
    const now = new Date('2026-01-01T00:59:59.000Z');
    const tier = gameUrgencyTier(
      {
        current_turn: 'white',
        white_player_id: viewerId,
        updated_at: '2026-01-01T00:00:00.000Z',
        time_control_hours: 1,
      },
      viewerId,
      now,
    );
    expect(tier).toBe('critical');
  });

  it('is normal when it is the viewers turn with plenty of time left', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const tier = gameUrgencyTier(
      {
        current_turn: 'white',
        white_player_id: viewerId,
        updated_at: '2026-01-01T00:00:00.000Z',
        time_control_hours: 24,
      },
      viewerId,
      now,
    );
    expect(tier).toBe('normal');
  });

  it('resolves the viewers color from black_player_id too', () => {
    const now = new Date('2026-01-01T00:59:59.000Z');
    const tier = gameUrgencyTier(
      {
        current_turn: 'black',
        white_player_id: opponentId,
        updated_at: '2026-01-01T00:00:00.000Z',
        time_control_hours: 1,
      },
      viewerId,
      now,
    );
    expect(tier).toBe('critical');
  });
});
