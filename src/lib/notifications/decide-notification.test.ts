import { decideGameChangeNotifications } from '~/lib/notifications/decide-notification';
import type { GameChangeSnapshot } from '~/lib/notifications/decide-notification';

const WHITE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const BLACK_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const GAME_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function snapshot(
  overrides: Partial<GameChangeSnapshot> = {},
): GameChangeSnapshot {
  return {
    id: GAME_ID,
    status: 'active',
    white_player_id: WHITE_ID,
    black_player_id: BLACK_ID,
    current_turn: 'white',
    result: null,
    ...overrides,
  };
}

describe('decideGameChangeNotifications', () => {
  it('notifies the creator of an accepted invitation, and the first mover of their turn, when a game becomes active', () => {
    const previous = snapshot({ status: 'waiting', black_player_id: null });
    const next = snapshot({ status: 'active' });

    const events = decideGameChangeNotifications(previous, next);

    expect(events).toEqual(
      expect.arrayContaining([
        { type: 'invitation_accepted', recipientId: WHITE_ID, gameId: GAME_ID },
        { type: 'your_turn', recipientId: WHITE_ID, gameId: GAME_ID },
      ]),
    );
    expect(events).toHaveLength(2);
  });

  it('notifies the black creator specifically, not always white, when black created the game', () => {
    const previous = snapshot({ status: 'waiting', white_player_id: null });
    const next = snapshot({ status: 'active' });

    const events = decideGameChangeNotifications(previous, next);

    expect(events).toEqual(
      expect.arrayContaining([
        { type: 'invitation_accepted', recipientId: BLACK_ID, gameId: GAME_ID },
      ]),
    );
  });

  it('notifies the new mover when the turn changes mid-game', () => {
    const previous = snapshot({ current_turn: 'white' });
    const next = snapshot({ current_turn: 'black' });

    const events = decideGameChangeNotifications(previous, next);

    expect(events).toEqual([
      { type: 'your_turn', recipientId: BLACK_ID, gameId: GAME_ID },
    ]);
  });

  it('notifies both players on completion, and does not also send a your_turn notification', () => {
    const previous = snapshot({ status: 'active', current_turn: 'white' });
    const next = snapshot({ status: 'completed', current_turn: 'black' });

    const events = decideGameChangeNotifications(previous, next);

    expect(events).toEqual(
      expect.arrayContaining([
        { type: 'game_completed', recipientId: WHITE_ID, gameId: GAME_ID },
        { type: 'game_completed', recipientId: BLACK_ID, gameId: GAME_ID },
      ]),
    );
    expect(events).toHaveLength(2);
  });

  it('notifies both players when a game is abandoned (resignation), not just completed', () => {
    const previous = snapshot({ status: 'active' });
    const next = snapshot({ status: 'abandoned', result: 'abandoned' });

    const events = decideGameChangeNotifications(previous, next);

    expect(events.every((e) => e.type === 'game_completed')).toBe(true);
    expect(events).toHaveLength(2);
  });

  it('sends nothing when neither turn nor status changed', () => {
    const previous = snapshot();
    const next = snapshot();

    expect(decideGameChangeNotifications(previous, next)).toEqual([]);
  });

  it('sends nothing further once a game is already terminal', () => {
    const previous = snapshot({ status: 'completed' });
    const next = snapshot({ status: 'completed' });

    expect(decideGameChangeNotifications(previous, next)).toEqual([]);
  });
});
