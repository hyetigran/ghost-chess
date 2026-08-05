// Up to 2 alphanumeric characters, uppercased — the initials shown on a
// player's placeholder avatar circle when there's no real photo (no
// upload feature exists yet).
export function initials(username: string): string {
  const cleaned = username.replace(/[^a-zA-Z0-9]/g, '');
  return (cleaned.slice(0, 2) || '?').toUpperCase();
}

// Deterministic hash so the same username always renders the same avatar
// color, rather than one that changes every render.
export function avatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}
