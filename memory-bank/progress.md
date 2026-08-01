# Progress — Ghost Chess

## What works / exists

- Expo app shell (Expo 52, Router, NativeWind, theme toggle, basic UI kit).
- Auth routing skeleton (`src/app/_layout.tsx` session gate; `(auth)` group; Google/Apple components).
- Domain types for game state (`src/types/game.ts`).
- Initial game state helper (`src/lib/game/state-helper.ts`) — FEN/visibility stubs; chess.js not wired.
- Game API client against legacy `games` table (`src/api/game/client.ts`).
- Legacy guest identity via MMKV UUID + RPC (`src/lib/auth/guest-auth.ts`).
- Supabase schema draft with dual auth/guest columns and conversion helper (`supabase/schema.ts`).
- Product docs: `PRD.md`, `CONTEXT.md`, `ARCHITECTURE.md`, `docs/adr/0001`–`0007`.
- Memory bank: `memory-bank/*` core files.

## What’s left (high level)

### Backend / data (blocking for online occlusion)

- [ ] Migrate to Anonymous Auth; remove `white_guest_id` / `black_guest_id` / `set_guest_id` / `guest_conversions`.
- [ ] Implement `player_views` + sync trigger.
- [ ] RLS: clients SELECT only own view; no client SELECT of true active `games` state.
- [ ] Move RPC/path with constant-time illegal rejection.
- [ ] Per-move deadline enforcement server-side.
- [ ] Realtime on `player_views` only.

### Game logic / client

- [ ] Add chess.js; real move application + legality.
- [ ] Chess board component (select, legal highlights, perspectives).
- [ ] Capture flash + captured-piece trays.
- [ ] Reveal full board on game completion.
- [ ] Local pass-and-play offline.
- [ ] AI opponent reading only redacted view.
- [ ] Move confirmation (client-only UX).
- [ ] Settings: sound, vibration, time control options.

### Product surfaces

- [ ] Home / create game / how to play / profile stats.
- [ ] Onboarding tutorial + demo.
- [ ] Push: invites, your-turn, completion, time warnings.

## Current status

**Phase**: Design locked; implementation still largely Phase 1 scaffolding + legacy guest/schema. Online occlusion architecture is specified, not built.

## Known issues / debt

- `getGame` / list paths return full `games` rows including true state — contradicts ADR 0001.
- Guest scheme is insecure for invite/share flows — superseded by ADR 0005 but still coded.
- Possible missing package declarations vs imports (`chess.js`, supabase client — verify).
- Duplicate / transitional app entry points (`app/` vs `src/app/`, `_layout1.tsx`).
- `ARCHITECTURE.md` must be updated as each ADR lands in code so it stays descriptive, not only aspirational.
