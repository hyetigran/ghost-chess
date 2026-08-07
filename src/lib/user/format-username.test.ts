import { formatUsername } from '~/lib/user/format-username';

describe('formatUsername', () => {
  it('abbreviates a generated guest username to Guest + a short suffix', () => {
    expect(formatUsername('guest_7c0927fca6a14e829bbff3722a96120a')).toBe(
      'Guest 7C09',
    );
  });

  it('leaves a real, user-chosen username unchanged', () => {
    expect(formatUsername('alice')).toBe('alice');
  });

  it('leaves a username that merely starts with "guest" but is not the generated shape unchanged', () => {
    expect(formatUsername('guest_of_honor')).toBe('guest_of_honor');
  });
});
