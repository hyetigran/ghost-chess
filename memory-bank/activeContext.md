# Active Context — Ghost Chess

## Current focus

Design and docs for the target architecture are in place (`CONTEXT.md`, `ARCHITECTURE.md`, ADRs 0001–0007, updated `PRD.md`). The **codebase still implements the pre-ADR guest/schema model**. Next work is closing the gap between legacy implementation and the ADRs.

## Recent changes

- Product/architecture docs written and aligned (Visibility, Guest, Move rejection).
- ADRs recorded for: server-side redaction, shadow `player_views`, reveal-on-completion, AI under occlusion, anonymous auth for guests, per-move clocks, constant-time illegal rejection.
- App scaffolding from Obytes / react-native-reusables: auth routing, Google/Apple sign-in stubs, theme UI, early game types + `createGame` / guest helpers.
- Memory bank initialized (this folder) for session continuity.
- Full audit done against the live tree (not just prior notes) — confirmed all previously-flagged gaps plus new ones: dual Expo Router roots (`app/` vs `src/app/`), dual app config (`app.json` junk vs `app.config.ts`), dual auth systems (legacy token store vs Supabase session), dead `_layout1.tsx`, undeclared `chess.js`/`@supabase/supabase-js` deps, zero test files despite CI running `pnpm test`.
- Filed 27 GitHub issues (#4–#30) on `hyetigran/ghost-chess` covering all of the above, labeled `cleanup` / `backend` / `client` / `product-surface` / `testing`. This is now the canonical work backlog — check open issues before re-deriving "what's left" from scratch.
- Executed the cleanup batch (#4, #5, #6, #7, #8 — router root, dead `_layout1.tsx`, app config, assets, dual auth systems). Removed: root-level `app/`/`components/`/`lib/` (unwired react-native-reusables scaffold — confirmed via `@expo/cli`'s router-root resolution that `src/app` is what Expo actually uses, and confirmed via grep that nothing in `src/` reaches root via the `~/` alias), `app.json` + `assets/images/*` (redundant with `app.config.ts`), stray root `index.js` and `build/config.gypi`, `src/app/_layout1.tsx`, `src/app/[...messing].tsx`, orphaned `src/components/settings/*`, legacy `src/lib/auth/{index,utils}.tsx` token store, orphaned `src/api/common/*` + `src/api/index.tsx`. Verified via grep sweep + `pnpm type-check` that this introduced zero new breakage.
- **Found but intentionally left alone** (broken imports in legitimate WIP files, not dead code — fixing needs a feature/design decision, not a deletion): `src/app/onboarding.tsx` (imports deleted `@/components/cover`, `@/components/ui`), `src/app/(auth)/index.tsx` (imports deleted `@/components/SwipeableRow`, references an undefined `Todo` type — looks like unadapted tutorial boilerplate), `src/lib/use-theme-config.tsx` (imports deleted `@/components/ui/colors`).
- Typecheck also surfaced more undeclared-dependency gaps than issue #9 originally scoped: `expo-image-picker`, `base64-arraybuffer`, `expo-apple-authentication`, `@react-native-google-signin/google-signin`, `@react-native-async-storage/async-storage`, `@types/uuid`, in addition to `@supabase/supabase-js`/`chess.js`. Issue #9 updated accordingly.
- **Major discovery: local `main`'s git history is completely disconnected from the real GitHub remote.** `git merge-base` returns nothing against `origin/main` or any remote branch. Local `main` (Obytes-starter lineage, root commit "Initial commit") and the real remote (root commit "initialize project with @react-native-reusables/cli") share zero history. All work from this session was pushed to a new branch, `origin/local-work`, rather than `main` — nothing on the real remote was touched or force-pushed.
- **The real remote has a further-along branch: `origin/add-game`** (off the real `origin/main`, not merged). It's a working standard online chess app: proper split Supabase schema (`supabase/schemas/{extensions,users,games,moves,indexes,rls,functions}.sql` + a migration), chess.js-backed board (`src/components/game/board/chess-board.tsx`), captured-pieces tray, game controls/game-over modal, ELO rating system, Supabase Anonymous Auth for guests (already matches ADR-0005's intent), ~~game creation/join screens~~.
- **Critical gap on `add-game`: zero occlusion/invisibility mechanic exists anywhere** (confirmed via exhaustive grep — no visibility/hidden/redact/fog code at all). The chess board renders the true FEN unconditionally to both players. It's a fully-visible online chess app, not "Ghost Chess" — the entire premise of the product is unbuilt there. It also structurally contradicts several ADRs rather than partially fulfilling them: move validation is client-side only (no server enforcement, `docs/adr/0001`/`0007`), and time control is a cumulative Fischer-style clock (`timeControl` minutes + `timeIncrement` seconds) rather than per-move deadlines (`docs/adr/0006`).
- Re-audited all 27 filed issues against `add-game`'s actual code and commented on each with specific findings (not closed — even the "done" pieces like the board/timer need rearchitecting, not just extension, to match the ADRs). Rough status: #10 (anon auth) mostly done, one native-redirect bug found; #16 (chess.js) done client-side, needs a server-side home; #17 (board), #18 (captured pieces), #23 (settings), #24 (home), #25 (game creation) partially done; #11, #12, #13, #14, #19, #20, #21, #22, #26, #27, #29, #30 confirmed still fully open on that branch too.
- **Next step for whoever picks this up**: decide how to reconcile `local-work` (design docs: CONTEXT.md/ARCHITECTURE.md/ADRs/PRD.md/memory-bank) with `add-game` (working non-occluded chess app) as the actual path forward — the docs describe the target, `add-game` is the closest real foundation, but the two haven't been merged and the occlusion work is the gap between them.

## Active decisions

- **Target auth**: Supabase Anonymous Auth; remove custom guest UUID scheme.
- **Target data**: `games` (true) + `player_views` (redacted); clients never read true FEN while active.
- **Legacy still in tree**: `supabase/schema.ts`, `src/lib/auth/guest-auth.ts`, `src/api/game/client.ts` use `white_guest_id` / `set_guest_id` / full-row selects.

## Open considerations

- Migrate schema + RLS before building Realtime on `player_views`.
- Wire chess.js into `src/lib/game/state-helper.ts` (TODO already flagged).
- Resolve dual router roots (`src/app` vs root `app/`) as the app stabilizes.
- Confirm package.json includes all runtime deps used by supabase/chess paths.

## Next steps (suggested order)

1. Schema migration to anonymous-auth + single player IDs; drop guest_id columns/RPCs.
2. Add `player_views` + transactional redaction trigger.
3. Change game client to subscribe/read only `player_views`; move submission through constant-time server validation.
4. Integrate chess.js for legality and FEN updates.
5. Build board UI + local/AI/online loops against the new contract.
