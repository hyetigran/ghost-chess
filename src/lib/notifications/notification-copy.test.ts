import { notificationCopy } from '~/lib/notifications/notification-copy';

describe('notificationCopy', () => {
  it('describes an accepted invitation', () => {
    expect(notificationCopy({ type: 'invitation_accepted' })).toEqual({
      title: 'Opponent found!',
      body: 'Someone joined your game — it starts now.',
    });
  });

  it('describes a your-turn notification', () => {
    expect(notificationCopy({ type: 'your_turn' })).toEqual({
      title: 'Your turn',
      body: "It's your move.",
    });
  });

  it('describes a completed game', () => {
    expect(notificationCopy({ type: 'game_completed' })).toEqual({
      title: 'Game over',
      body: 'Your game has ended — tap to see how it finished.',
    });
  });

  it('describes a time warning', () => {
    expect(notificationCopy({ type: 'time_warning' })).toEqual({
      title: 'Time is running out',
      body: "You're close to your move deadline in an active game.",
    });
  });
});
