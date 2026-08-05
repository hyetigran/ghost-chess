import { avatarColor, initials } from '~/lib/user/avatar';

describe('initials', () => {
  it('takes the first two alphanumeric characters, uppercased', () => {
    expect(initials('tigran')).toBe('TI');
  });

  it('strips non-alphanumeric characters before taking initials', () => {
    expect(initials('guest_d1688578')).toBe('GU');
  });

  it('falls back to "?" for an empty/non-alphanumeric username', () => {
    expect(initials('')).toBe('?');
    expect(initials('___')).toBe('?');
  });

  it('handles a single-character username', () => {
    expect(initials('x')).toBe('X');
  });
});

describe('avatarColor', () => {
  it('is deterministic for the same username', () => {
    expect(avatarColor('tigran')).toBe(avatarColor('tigran'));
  });

  it('differs for different usernames', () => {
    expect(avatarColor('tigran')).not.toBe(avatarColor('someone-else'));
  });

  it('returns a valid hsl() string', () => {
    expect(avatarColor('tigran')).toMatch(/^hsl\(\d+, 55%, 45%\)$/);
  });
});
