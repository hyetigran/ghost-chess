# Active Context — Ghost Chess

## Current focus

**Shipping / native build readiness** after the occlusion MVP is largely implemented on `main` (via the `add-game` → player-views lineage). Recent work: EAS profile setup, env/bundle-id cleanup, Firebase credential gitignores, and squashing Supabase migrations.

Branch in progress: `squash-initial-migration` (HEAD includes migration squash; uncommitted: `eas.json`, env rename, package IDs, `googleServicesFile`).

## Recent changes

- **Occlusion stack landed** on the real remote lineage (`main`): `player_views`, server `submit-move`, Realtime on views only, per-move deadlines, board/UI, local + AI play, invites, onboarding, push notifications, pgTAP redaction suite. See `progress.md` for ticket-by-ticket detail (#12–#30, #32).
- **Migrations squashed** (`20260803000000_initial_schema.sql`): 12 incremental files → one; verified byte-identical schema dump + pgTAP/app tests. Manually restored `REVOKE ALL … FROM anon/authenticated` on `move_attempts` / `player_views` after `supabase migration squash` dropped them (default privileges would under-restrict).
- **EAS `eas.json` rewritten** from CLI defaults to Obytes-style profiles: `production` / `staging` / `development` / `simulator`, each with `channel`, `pnpm: "9.12.3"`, `APP_ENV`, `EXPO_NO_DOTENV`. Production = store + AAB; staging = internal + APK. Skipped example’s `dapp-store` / `FLIPPER_DISABLE`.
- **Env / identity cleanup (WIP, uncommitted)**: `EXPO_PUBLIC_SUPABASE_ANON_KEY` → `EXPO_PUBLIC_SUPABASE_KEY`; bundle/package `app.ghostchess.game` → `app.ghostchess`; Android `googleServicesFile: './google-services.json'`; gitignore for Firebase/FCM credential files.
- **Still missing for staging builds**: no `.env.staging` file yet (only `.env.development` / `.env.production`). Staging EAS profile will fail `env.js` validation until that exists.

## Active decisions

- **Canonical implementation** is `main` on the real GitHub remote (Anonymous Auth + `player_views` + edge validation). The old disconnected `local-work` / dual-history concern is historical — docs and code live together on this lineage now.
- **Occlusion contract unchanged**: clients never read true FEN while `active`; dual TS/SQL mirrors (`redact-fen`, `decide-move`, notification helpers) stay reference implementations, not enforcement.
- **EAS**: `APP_ENV` drives `.env.${APP_ENV}` via `env.js`; `EXPO_NO_DOTENV=1` on cloud builds so Expo doesn’t fight that loader.
- **Invite-only MVP** (no matchmaking UI); AI is heuristic under occlusion (no privileged board); capture flash is square highlight, not piece sprite.

## Open considerations

- Wire home (#24) local / vs-AI entry points — `#20`/`#21` now exist (`/local-game`, `/ai-game`), so the prior blocker is gone.
- Create `.env.staging` (and secrets for EAS) before first staging build.
- Sound toggle persists but has no audio library / consumer yet.
- Pawn promotion UI: board defaults to auto-queen; no piece picker.
- Push: server→Expo path verified; physical-device delivery not verified (needs EAS build + device).
- `ARCHITECTURE.md` “Implementation status → Not started” list is stale vs `progress.md` — prefer progress until that section is refreshed.

## Next steps (suggested order)

1. Finish and commit the EAS/env/bundle-id/google-services WIP; add `.env.staging` (+ document required EAS secrets).
2. Close out #24: link Local Play / vs AI from home (routes already exist).
3. First EAS development or simulator build; validate push on a real device when ready.
4. Optional polish: promotion picker, sound playback, matchmaking (explicitly out of MVP invite scope).
