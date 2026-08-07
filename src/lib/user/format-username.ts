// Guests get a generated placeholder username (handle_new_user(),
// supabase/schemas/08_functions.sql): 'guest_' + their full 32-hex-char
// id with dashes stripped, 38 characters total — fine as a stored,
// always-unique value, but far too long for any of the tight row/card
// layouts it gets displayed in (it was overflowing PlayerCard and
// pushing the move clock off-screen). A short suffix, not just "Guest",
// keeps guests visually distinguishable from each other in a list (the
// open-invitations browse screen, the turn-queue list) rather than every
// guest row reading identically.
const GUEST_USERNAME_PATTERN = /^guest_([0-9a-f]{32})$/;

export function formatUsername(username: string): string {
  const match = username.match(GUEST_USERNAME_PATTERN);
  if (!match) return username;
  return `Guest ${match[1].slice(0, 4).toUpperCase()}`;
}
