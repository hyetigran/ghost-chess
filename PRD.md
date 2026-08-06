### Ghost Chess (Fog of War Chess) - Product Requirements Document (PRD)

## 1. Product Overview

### 1.1 Product Vision

Ghost Chess is a mobile application that offers a unique twist on traditional chess. Players see their own pieces plus only the opponent pieces their own pieces currently threaten — everything else stays hidden, and the game ends by capturing the enemy king rather than by checkmate. This creates a game of memory, deduction, and strategy that challenges even experienced chess players in new ways. (Earlier versions of this product hid the opponent's pieces unconditionally rather than by attack-based reveal — see `docs/adr/0008-attack-based-fog-of-war-vision.md` for why that changed.)

### 1.2 Target Audience

- Chess enthusiasts looking for a new challenge
- Casual gamers who enjoy strategy games
- Players of all skill levels, from beginners to advanced
- Age range: 12+ (anyone familiar with basic chess rules)

## 2. Game Mechanics

### 2.1 Core Gameplay

- Standard chess piece-movement rules apply, with two deliberate exceptions: there is no check/checkmate, and a move that leaves the mover's own king capturable next turn is legal, not prevented (see King capture below)
- Each player sees their own pieces plus any opponent piece their own pieces currently attack — everything else on the board is hidden
- An opponent piece outside the viewer's own attack range is invisible; the only other exception is the instant one is captured
- When a player attempts any illegal move — including one that targets a square outside their vision — the move is rejected with the same generic feedback as any other illegal move. The rejection never reveals why, so it discloses nothing about the opponent's position (see §3.4 for how this is enforced end-to-end, including at the response-timing level)
- When a player captures an opponent's piece, it becomes visible briefly before being removed
- The game tracks and displays captured pieces for both players
- King capture: the game ends the instant a move captures the opponent's king — there is no checkmate condition to detect separately
- Once a game ends (a king is captured, draw, resignation, or abandonment/timeout), the true board position is revealed to both players

### 2.2 Visibility Rules

- Player's own pieces: Always visible
- Opponent's pieces: Visible only on a square one of the viewer's own pieces currently attacks — sliding pieces (bishop/rook/queen) reveal up to and including the first blocker on a ray, pawns reveal only their diagonal capture squares (never the square directly ahead), knights and the king reveal their normal one-step-or-jump reach. Everything else stays hidden, recomputed fresh from the current position every move (no memory of squares that were visible earlier and have since fallen out of reach)
- Captured pieces: Displayed in a "captured pieces" area
- Legal moves: Highlighted for selected pieces, including ones that would leave the mover's own king capturable — that's a legal (if risky) move here, not something the UI withholds
- Failed moves: All illegal moves — including attempts to move onto a square outside the mover's vision — receive identical, generic "illegal move" feedback. Nothing about *why* a move failed is ever disclosed, whether through response content or response timing. Visibility never affects legality: whether a move is legal is decided against the true board regardless of what the mover can see, so a square being outside vision only ever changes whether the mover is *told* what's there, never whether the move itself is allowed
- Check: there is no check concept. A player is never told their king is threatened, since — unlike the old absolute-occlusion model — that information genuinely isn't always available to them; the game simply ends if the capture actually happens
- Game completion: Once a game is no longer active, occlusion lifts entirely and both players can see the true final position

### 2.3 Game Modes

- Online multiplayer: Play against other users in real-time. This includes guests (see §3.3) — an account is not required to play a full online game
- Local play: Pass-and-play on a single device
- AI opponent: Practice against computer opponents of varying difficulty. The AI plays under the same information constraints as a human opponent — it never has access to the player's hidden pieces, only whatever its own pieces currently reveal. Difficulty comes from how well it reasons under uncertainty, not from privileged board access

### 2.4 Game Settings

- Time controls: Per-move deadlines (1 hour, 12 hours, or 24 hours to make each move), not a cumulative game clock. The deadline resets at the start of each of a player's turns; missing it forfeits the game. There is no grace period — if a "your turn" notification (§4.4) is missed and the deadline lapses, the forfeit is final
- Move confirmation: Optional client-side "are you sure?" prompt shown before a move is sent to the server. This is purely local UX based on what the player already sees — it never involves a server round-trip or a preliminary legality check, which would otherwise create a second way to probe hidden squares beyond the single move-submission path (§3.4)
- Sound effects: Toggleable
- Vibration feedback: Toggleable

## 3. Technical Requirements

### 3.1 Platform

- Primary: iOS and Android via Expo/React Native
- Secondary (future): Web version

### 3.2 Architecture

- Frontend: React Native with Expo
- State Management: Zustand for local state, React Query for server state
- Styling: NativeWind (Tailwind CSS for React Native)
- Game Logic: chess.js for move validation and game state
- Backend: Supabase for authentication, database, and real-time functionality
- Visibility enforcement: Server-side redaction. Clients never receive the true board state while a game is active — see §3.3 for how this is modeled and `CONTEXT.md` / `docs/adr/0001-server-side-redaction.md` for the full rationale

### 3.3 Data Model

#### Users

- User ID (primary key) — a real `auth.users` row for every player, including guests
- Username, Email, Authentication details — present for registered accounts; absent for guests
- Guest flag — guests authenticate via Supabase Anonymous Auth rather than a separate identity scheme, so `auth.uid()` works uniformly for guests and registered users. A guest can convert to a full account later without losing their ID or game history (`docs/adr/0005-anonymous-auth-for-guests.md`)
- Profile information
- Statistics (wins, losses, draws)

#### Games

- Game ID (primary key)
- Player IDs (white and black) — a single ID column per side; no separate guest-ID column, since guests share the same identity model as registered users
- True game state (FEN notation) — the authoritative position. Never returned directly to game clients while the game is active (`docs/adr/0001-server-side-redaction.md`)
- Move history
- Game settings
- Game status (active, completed, abandoned)
- Timestamps (created, updated, completed)

#### Player Views (redacted state)

- One row per (Game ID, Player ID), holding only what that player is currently allowed to see: their own pieces, capture history, check status, and the move-rejection/deadline signals described in §2.2/§2.4 — never the opponent's true position
- Kept in sync with Games by a database trigger that recomputes both players' rows in the same transaction as every move, so a client can never observe a Games update without the corresponding redacted update (`docs/adr/0002-shadow-table-for-redacted-views.md`)
- Once a game's status leaves `active`, redaction lifts and this row reflects the true final position for both players (`docs/adr/0003-reveal-on-game-completion.md`)
- Clients subscribe to real-time changes on this table, scoped by row-level security to their own row — never on Games directly, which would otherwise broadcast the true position to both players regardless of application-level redaction

#### Moves

- Move ID (primary key)
- Game ID (foreign key)
- Player ID
- From square
- To square
- Piece moved
- Piece captured (if any)
- Resulting position (FEN)
- Timestamp

### 3.4 Performance Requirements

- Game state updates must be real-time (<500ms latency)
- App should function offline for local games
- Minimal battery consumption
- Efficient memory usage for long-running games

## 4. User Experience

### 4.1 Onboarding

- Brief tutorial explaining the unique rules
- Interactive demo game
- Quick start guide for chess beginners

### 4.2 User Interface

- Clean, minimalist design
- Responsive chess board that adapts to different screen sizes
- Clear visual feedback for moves, captures, and game events
- Accessibility features (color contrast, screen reader support)

### 4.3 Key Screens

- Home/Dashboard: Game options, stats, recent games
- Game Creation: Settings, invitations
- Game Screen: Chess board, captured pieces, move history, game controls
- How to Play: Rules explanation and strategy tips
- Profile: User stats, history, settings

### 4.4 Notifications

- Game invitations
- Your turn notifications — load-bearing under per-move time controls (§2.4): a missed notification does not pause or extend the deadline, and a lapsed deadline forfeits the game with no reconciliation
- Game completion alerts
- Time control warnings

## 5. Implementation Details

### 5.1 Chess Board Component

- Responsive grid layout
- Touch interaction for piece selection and movement
- Visual indicators for selected pieces and legal moves
- Support for board rotation (white/black perspective)

### 5.2 Game State Management

- Local state for UI interactions
- Server state for persistent game data
- Real-time synchronization between players
- Conflict resolution for simultaneous actions

### 5.3 Move Validation

- Client-side validation for immediate feedback
- Server-side validation for security
- Special move handling (castling, en passant, promotion)

### 5.4 Anti-Cheat Mechanisms

- Server-side game state validation
- Constant-time move rejection: illegal-move handling must not branch into reason-specific code paths that do different amounts of work (e.g. no early-return "fast path" for geometrically-obvious illegal moves, no extra logging on only one branch). Response *content* for illegal moves is already generic (§2.2); this ensures response *timing* can't reopen that same leak. Legal-vs-illegal timing differences are fine — only illegal-for-which-reason needs to stay indistinguishable (`docs/adr/0007-constant-time-move-rejection.md`)
- Move timing analysis and suspicious pattern detection, to catch engine-assisted play — the same class of problem any online chess platform has, not specific to this game's hidden-information mechanic
- Reporting system for players

## 6. Analytics and Metrics

### 6.1 Key Performance Indicators

- User acquisition and retention
- Game completion rate
- Average game duration
- Feature usage statistics

### 6.2 User Feedback

- In-app rating system
- Feedback form
- Bug reporting mechanism

## 7. Future Enhancements

### 7.1 Planned Features

- Tournaments and leagues
- Advanced statistics and analysis
- Social features (friends, messaging)
- Additional game variants
- Puzzle mode based on Fog of War scenarios

### 7.2 Monetization Options

- Premium subscription with advanced features
- Cosmetic upgrades (board themes, piece sets)
- Tournament entry fees
- Ad-supported free tier

## 8. Development Roadmap

### 8.1 Phase 1: MVP

- Core game mechanics
- Basic UI
- Local gameplay
- Simple AI opponent

### 8.2 Phase 2: Online Functionality

- User accounts
- Online matchmaking
- Game persistence
- Basic social features

### 8.3 Phase 3: Polish and Expansion

- Enhanced UI/UX
- Advanced game options
- Comprehensive statistics
- Additional game modes

## 9. Technical Considerations

### 9.1 Error Handling

- Graceful degradation during connectivity issues
- Game state recovery mechanisms
- Comprehensive error logging

### 9.2 Security

- Secure authentication, including for guests — guest sessions use Supabase Anonymous Auth (a real, signed session) rather than a client-generated, unauthenticated identifier, since guests are shareable/invitable full players and a bare bearer identifier would be exposed by the invite flow itself (`docs/adr/0005-anonymous-auth-for-guests.md`)
- Protection against common exploits
- Data privacy compliance

### 9.3 Testing Strategy

- Unit tests for game logic
- Integration tests for API interactions
- End-to-end tests for critical user flows
- Beta testing program

## 10. Appendix

### 10.1 Glossary

- FEN: Forsyth-Edwards Notation, a standard notation for describing chess positions
- King capture: The only way a game ends other than a draw, forfeit, or resignation — capturing the opponent's king ends the game immediately. There is no check or checkmate in this game (see `CONTEXT.md`'s King capture entry)
- Castling: A special move involving the king and rook
- En passant: A special pawn capture move

### 10.2 References

- Official chess rules
- Chess.js documentation
- Expo/React Native best practices
- Supabase documentation
- `CONTEXT.md` — canonical domain glossary (Visibility, Move rejection, Guest, etc.); defers to this over the prose in this PRD if the two ever diverge
- `ARCHITECTURE.md` — the synthesized technical picture (data flow, redaction, auth, move validation) referenced throughout this document
- `docs/adr/` — architecture decision records for the hard-to-reverse calls referenced throughout this document

---

This PRD serves as a comprehensive reference for the Ghost Chess application, outlining all aspects of the product from game mechanics to technical implementation details. It should be treated as a living document that evolves as the project progresses.
