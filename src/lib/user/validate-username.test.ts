import { validateUsername } from '~/lib/user/validate-username';

describe('validateUsername', () => {
  it('accepts a normal username', () => {
    expect(validateUsername('ghost_knight')).toEqual({ valid: true });
  });

  it('rejects an empty username', () => {
    expect(validateUsername('')).toEqual({
      valid: false,
      error: 'Username cannot be empty.',
    });
  });

  it('accepts a username at exactly the 50-character limit', () => {
    expect(validateUsername('a'.repeat(50))).toEqual({ valid: true });
  });

  it('rejects a username over the 50-character limit', () => {
    expect(validateUsername('a'.repeat(51))).toEqual({
      valid: false,
      error: 'Username must be 50 characters or fewer.',
    });
  });
});
