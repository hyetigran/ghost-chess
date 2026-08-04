# Handoff: Chess app — core play flow (mobile + web)

## Overview
A five-screen core loop for a chess app built with React Native + Expo (iOS, Android, web):
**New game → Pairing → Live game → Game-over sheet → Game review.**
Two complete themes (light + dark) plus a foundations sheet (color, type, radii, spacing, button states).

## About the Design Files
The files in this bundle are **design references authored in HTML** — prototypes showing intended look, layout, and behavior. They are **not production code to copy**. The task is to **recreate these designs in the target codebase** using its own environment and patterns: React Native + Expo with `StyleSheet`, `SafeAreaView`, `Pressable`, `react-navigation`, `react-native-reanimated`, and `expo-font`. Where no equivalent primitive exists (e.g. the bottom sheet), pick the library the project already uses or the best-supported option (`@gorhom/bottom-sheet`).
Open the HTML files in a browser to view them; they render standalone.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, shadows, and states are specified. Recreate the UI to match. Hex values, font weights, and pixel sizes below are authoritative — the HTML is the visual reference for anything not written down.

Screen canvas: **390 × 844** (iPhone 14 logical px). Board is always a **square equal to screen width** (390 in the mock) and is the layout anchor; everything else compresses around it.

## Design Tokens

### Color — light
| token | hex | use |
|---|---|---|
| bg | #F7F6F3 | screen background |
| bgBoard | #F1EFE9 | game screens (warmer, so board pops) |
| card | #FFFFFF | cards, rows |
| cardAlt | #FCFBF8 | game-screen cards, white pieces |
| border | #E3E0D8 | 1px card border |
| borderStrong | #D8D4CA | 1.5px secondary button border |
| ink | #1B1A17 | primary text |
| muted | #6E6A62 | secondary text |
| faint | #8A857C | mono labels, metadata |
| accent | #4F7A3B | primary action, active clock, progress |
| accentPressed | #3C612C | pressed primary |
| accentTint | #EDF3E7 | selected chip/row fill, badges |
| accentInk | #33521F | text on accentTint |
| accentDisabled | #C9D6BF | disabled primary fill (text #F0F4EC) |
| danger | #C63F31 | resign, check ring, unread dot |
| highlight | #F0D656 | last-move / selected square (45% / 28% alpha) |
| squareLight | #EDE3CB | board light square |
| squareDark | #6C8F4E | board dark square |
| pieceWhite | #FCFBF8 | white pieces (text-shadow 0 1px 2px rgba(27,26,23,.4)) |
| pieceBlack | #2B2A27 | black pieces |

### Color — dark
| token | hex |
|---|---|
| bg | #14171A |
| bgBoard | #101315 |
| card | #1E2328 |
| cardAlt | #232A2F |
| sheet | #1B2024 |
| border | #2A3037 |
| borderStrong | #3A4149 |
| ink | #EDEEEC |
| muted | #9AA0A6 |
| faint | #6B7378 |
| accent | #6FA24C (text on accent: #0F1416) |
| accentTint | #26301F |
| accentInk | #C7E3AC |
| accentBright | #8FBE6B (icons, small accents) |
| danger | #E2705F |
| squareLight | #A9B885 |
| squareDark | #55703C |
| pieceWhite | #FCFBF8 (shadow rgba(0,0,0,.45)) |
| pieceBlack | #191A16 |
| evalGraph | #D7DBD4 on #0D1012 (light: #F7F6F3 on #2B2A27) |

### Typography
Fonts: **Manrope** (400/500/600/700/800) for UI, **IBM Plex Mono** (400/500/600) for clocks, ratings, move notation, and section labels. Load via `expo-font` / `@expo-google-fonts/manrope` + `@expo-google-fonts/ibm-plex-mono`.

| style | spec |
|---|---|
| Display (result) | Manrope 800 · 30 / 34 · letter-spacing −3% |
| Screen title | Manrope 800 · 22 / 28 · −2% |
| Stat number | Manrope 800 · 22 |
| Chip value | Manrope 700 · 17 |
| Row title / button | Manrope 700 · 16 (buttons 800 · 18 for primary) |
| Body | Manrope 500 · 14 / 20 |
| Meta | Manrope 500 · 12 |
| Section label | IBM Plex Mono 600 · 11 · letter-spacing .08em · uppercase |
| Clock | IBM Plex Mono 600 · 20 · −2% |
| Rating / notation | IBM Plex Mono 500 · 13 |
| Micro label | IBM Plex Mono 600 · 10 |

### Spacing, radii, shadows, motion
- Spacing scale: 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 22 / 26 / 34. Screen horizontal padding **20** (game screens **16**, so the board can be full-bleed). Bottom safe padding **34**.
- Radii: 12 icon tile · 14 mono strip / nav square · 16 chip / small card · 18 card + button · 30 sheet top · 38 screen shell · 99 pill.
- Shadows (light only; dark uses borders instead): card `0 1px 2px rgba(27,26,23,.06)`; raised primary `0 6px 16px rgba(79,122,59,.35)`; sheet `0 -12px 40px rgba(27,26,23,.28)`; board `0 2px 12px rgba(27,26,23,.12)`. Dark: primary glow `0 6px 18px rgba(111,162,76,.28)`, sheet `0 -12px 40px rgba(0,0,0,.6)`.
- Motion: taps 180ms ease-out (scale .98 on press); sheet in 260ms cubic-bezier(.2,.8,.2,1); piece snap 120ms ease-out; capture fade 140ms; progress bar animates continuously.
- Minimum hit target 44 × 44.

## Screens / Views

### 1. New game
**Purpose:** pick time control, opponent type, rated on/off, then search.
**Layout:** status bar 52 → header row (36px back tile + title, padding 6/20/14) → scroll body, `gap: 22` → sticky footer CTA with a `linear-gradient(to top, bg 60%, transparent)` fade.
- **Time control grid:** 3 columns, `gap: 10`, each tile card+border, radius 16, padding 14/0, centered. Value Manrope 700 · 17, category micro-mono under it. Selected tile: fill accentTint, **2px** accent border (padding drops to 13 to hold height), value in accentInk, category in accent. Last tile "Custom" = 1px dashed #C9C4B8, no fill, label Manrope 600 · 15 muted → opens a custom-time modal.
- **Opponent rows:** full-width cards, radius 18, padding 16, `gap: 14`; 38px radius-12 icon tile, two-line label (700 · 16 / 500 · 12 muted), trailing chevron muted. Selected row = accentTint fill + 2px accent border + 22px accent circle check (chevron replaced).
- **Rated row:** same card, trailing 52 × 31 switch, radius 16, knob 25px white, `inset 0 1px 2px rgba(0,0,0,.15)` on track. Off state: track #D8D4CA, knob left.
- **Primary CTA:** "Find opponent", full width, padding 17, radius 18, Manrope 800 · 18, white on accent, raised shadow. Disabled if no time control selected.

### 2. Pairing
**Purpose:** waiting state while matchmaking.
**Layout:** vertically centered block (`gap: 26`) + bottom action stack.
- 132px circle, card fill, `inset 0 0 0 2px accentTint` ring, 54px accent knight glyph. Animate a slow 2.4s pulse on the ring (scale 1 → 1.06, opacity 1 → 0) — the glyph itself does not move.
- Title Manrope 800 · 26; two-line body 500 · 15 muted, centered ("Rapid 10+0 · rated" / "Searching 1240–1330").
- Progress: 6px track radius 3, accent fill; below it mono row — elapsed timer left ("0:07", live), status right ("WIDENING RANGE" appears after 10s, else "SEARCHING").
- Bottom: "Play the computer instead" card row (keeps search alive), then "Cancel search" secondary button (1.5px borderStrong, radius 18, padding 16, Manrope 700 · 17).
**Transition on match found:** cross-fade to the game screen 240ms, with a brief "Matched!" state on the title (400ms) before navigating.

### 3. Live game
**Purpose:** play a move; read clocks at a glance.
**Layout, top → bottom:** status bar 52 · nav row (back / mono "RAPID 10+0 · RATED" / ⋯) · opponent strip · **390 square board** · own strip · move strip · 4-up action row · 34 bottom padding.
- **Player strip:** 40px radius-12 avatar (initials Manrope 700 · 15), name 700 · 16 + rating mono 500 · 13 faint, captured-pieces row (14px glyphs, faint), trailing clock.
- **Clock:** radius 12, padding 8/14, mono 600 · 20. **Inactive:** fill #E3E0D8 (dark #252B31), muted text. **Active:** accent fill, white text, raised accent shadow. Under 30s: danger fill + 1s tick pulse.
- **Board:** 8 rows of 8; square colors squareLight/squareDark. Overlays, in z-order: last-move squares highlight @28%, selected square highlight @45%, legal-move dots (30% of square, `rgba(27,26,23,.28)`, dark `rgba(0,0,0,.35)`), king-in-check `inset 0 0 0 4px danger @75%`. Capture targets: ring instead of dot (in the mock, Bc4 is selected — dots on b5/b3/d3, capture ring on the d5 pawn, last-move pair f1→c4). Nobody is in check in the mocked position, so the check ring appears only in the token list. Pieces are 38px glyphs in the mock — **replace with a real piece sprite set** (see Assets).
- **Move strip:** cardAlt, radius 14, padding 10/12, horizontal scroll, mono 500 · 13 muted; current move ink + 600. Tap a move to scrub; scrubbing shows a "return to live" pill.
- **Action row:** 4 equal cards, radius 16, padding 11/0, icon over mono 600 · 10 label — DRAW (accent ½), RESIGN (danger flag), FLIP (muted), CHAT (muted, 8px danger unread dot top-right). Draw and Resign open confirm dialogs.

### 4. Game-over sheet
**Purpose:** report result, rating delta, accuracy; route to review or another game.
**Layout:** the live screen stays mounted behind at **45% opacity** (board also `saturate(.7)` in light) under a scrim `rgba(27,26,23,.28)` light / `rgba(0,0,0,.5)` dark. Sheet is bottom-anchored, radius 30 top, padding 12/20/34, `gap: 18`, non-dismissable by swipe until an action is chosen (grabber is decorative).
- 44 × 5 grabber, then 56px radius-18 accentTint tile with 26px accent king glyph.
- "You won" Manrope 800 · 30 (−3%); subline 500 · 14 muted "By resignation · 38 moves"; rating pill accentTint radius 99, padding 6/14 — mono 700 · 13 delta + 600 · 13 "1284 → 1292 rapid". Loss: delta danger-toned, tile/pill use a neutral fill (#F1EFE9 / #232A2F), heading "You lost"; draw: "Draw".
- Accuracy card: single card split by a 1px divider, two columns, number 800 · 22 (yours accent, theirs muted) over mono 600 · 10 label.
- Actions: primary "Game review", then two secondary halves "Rematch" / "New game" (`gap: 10`).
**Entry animation:** scrim fade 200ms + sheet translateY 100% → 0 over 260ms cubic-bezier(.2,.8,.2,1); rating pill counts up over 500ms.

### 5. Game review
**Purpose:** step through the game with engine annotations.
**Layout:** status bar · nav row (✕ / "GAME REVIEW" / accent "Share") · 390 board · body padding 20, `gap: 14`.
- Board carries the same highlight system plus a floating verdict badge in the empty top-left corner (left/top 12; place it over empty squares, never over a piece): ink-dark pill radius 12, padding 7/12, mono 700 · 13 eval in #9FCC7E + Manrope 700 · 11 verdict, letter-spacing .04em.
- **Annotation card:** move Manrope 700 · 17 + verdict badge (accentTint pill, mono 700 · 10). Body 500 · 14 / 1.45 muted. Verdict palette: BRILLIANT / BEST → accent; INACCURACY → #C08A2E; MISTAKE → #C4703A; BLUNDER → danger.
- **Scrubber row:** 44px prev square (card + border, muted chevron) · 6px track with accent fill and a 20px knob (3px accent ring, white/bg core, `translateX(-10px)`) · 44px next square filled accent (white chevron). Under it a mono row: "MOVE 24 / 38" and "TAP GRAPH TO JUMP".
- **Eval graph:** card radius 18, padding 12; inner 52px block radius 8 — dark ground = black advantage, light polygon = white advantage, 1px midline @35% white, 2px accent playhead at current move. Tappable/draggable to jump.
- **Footer pair:** "Key moments" secondary + "Move list" inverse-fill button (ink bg / bg text; dark: #EDEEEC bg, #14171A text).

## Interactions & Behavior
- Navigation: Home → New game → Pairing → Game (replaces Pairing in the stack) → Game-over sheet (modal over Game) → Review (full-screen modal). ✕ on Review returns Home.
- Move input: tap piece → tap destination (also support drag). Illegal tap deselects. Promotion opens a 4-option inline picker over the target square. Confirm-move toggle is a setting; off by default.
- Realtime: single game socket. Optimistic local move, reconcile on server ack; on rejection revert with a 160ms shake on the piece.
- Reconnect: offline banner (danger, 32px) below nav; clocks freeze visually while disconnected.
- Loading: Pairing is the search state; the review board shows a skeleton (card fill, no pieces) until the analysis job returns; the annotation card and graph fade in when it does.
- Errors: search timeout after 60s → inline card "No opponents found — widen range / play computer". Analysis failure → "Review unavailable, retry".
- Haptics: light impact on move, success on win, warning at 10s remaining.
- Responsive / web: board is `min(screenWidth, 560)` and centers. ≥900px wide switches to two columns — board left, a right rail (420px) carrying player strips, move list, and chat — and the game-over state becomes a centered modal card (radius 18) rather than a bottom sheet. Bottom tab bar becomes a left sidebar on web ≥900px.
- Accessibility: all pieces and squares get labels ("white knight on f3"); board is keyboard-navigable on web (arrow keys + enter); clocks announce at 60s/30s/10s; every text pair meets 4.5:1 in both themes.

## State Management
Per screen:
- **New game:** `timeControl`, `customTime?`, `opponentType`, `computerLevel`, `rated`.
- **Pairing:** `searchStatus: idle|searching|widening|matched|timeout`, `elapsedMs`, `ratingRange`.
- **Game:** `fen`, `legalMoves`, `selectedSquare`, `lastMove`, `checkSquare`, `moves[]`, `viewingMoveIndex` (null = live), `clocks {white, black}`, `captured {white[], black[]}`, `orientation`, `drawOffer`, `unreadChat`, `connection`.
- **Result:** `result`, `termination`, `ratingBefore/After`, `accuracy {you, them}`.
- **Review:** `analysis[] {move, eval, verdict, comment, bestMove}`, `currentMoveIndex`, `analysisStatus`.
Server drives clocks (send remaining ms + server timestamp; interpolate locally, never count down authoritatively on device). Rules/validation via `chess.js`; engine analysis server-side or a wasm Stockfish worker on web.

## Assets
- **Fonts:** Manrope, IBM Plex Mono (Google Fonts, OFL).
- **Chess pieces:** the mocks use Unicode glyphs as stand-ins. Ship a real vector set — recommend **Cburnett** SVGs (CC BY-SA 3.0) or license a set — sized at 78% of the square, centered, with a subtle drop shadow for white pieces on dark squares.
- **Icons:** draw / resign / flip / chat are placeholders; substitute the project's icon library at 20px, 1.75px stroke.
- No raster assets, gradients, or photography.

## Files
- `Chess App Hi-Fi.dc.html` — hi-fi light (3a) and dark (3b) rows plus the foundations sheet. **Primary reference.**
- `Chess App Wireframes.dc.html` — earlier lo-fi wireframes (turn 1 single screens, turn 2 the same flow in both themes). Useful for intent and annotations; superseded visually.
- `support.js` — runtime needed for the two HTML files to render locally. Not part of the design.
