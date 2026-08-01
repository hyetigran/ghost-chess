export type UsernameValidation = { valid: true } | { valid: false; error: string };

// Mirrors userSchema.username's constraints (src/types/database.ts:
// z.string().min(1).max(50)) so the profile screen can reject an invalid
// edit locally before spending a round-trip on it.
export function validateUsername(username: string): UsernameValidation {
  if (username.length < 1) {
    return { valid: false, error: 'Username cannot be empty.' };
  }
  if (username.length > 50) {
    return { valid: false, error: 'Username must be 50 characters or fewer.' };
  }
  return { valid: true };
}
