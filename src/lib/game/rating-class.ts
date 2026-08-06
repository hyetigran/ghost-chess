// A simple 200-point band around a rating, for the "my rating class only"
// open-invitation filter (#33). Labeled by the numeric range itself
// rather than an invented letter class ("Class D") — a lettered taxonomy
// implies a canonical class table (a top class, a bottom class, agreed-on
// names) this app doesn't have, and inventing one is a product decision,
// not something to default silently. Cheap to add letters later if
// wanted; the underlying min/max this computes wouldn't need to change.
export function ratingClassRange(elo: number): {
  min: number;
  max: number;
  label: string;
} {
  const min = Math.floor(elo / 200) * 200;
  const max = min + 199;
  return { min, max, label: `${min}–${max}` };
}
