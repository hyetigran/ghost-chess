// A scripted demo position (#27) — not a real game, no server involved.
// The learner (white) has a pawn on e4 that can either move quietly to e5
// or capture a black pawn secretly sitting on d5. Both moves are
// deliberately left available so the demo works pedagogically either way
// the learner taps: capturing shows the reveal-on-capture mechanic,
// moving quietly shows that a non-capturing/illegal attempt reveals
// nothing either way.
export const DEMO_START_FEN = '6k1/8/8/3p4/4P3/8/8/6K1 w - - 0 1';
