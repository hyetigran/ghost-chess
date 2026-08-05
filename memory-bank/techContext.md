# Tech Context — Ghost Chess

## Stack

| Layer | Choice |
|-------|--------|
| App | Expo ~52, React Native 0.76, Expo Router ~4 |
| Language | TypeScript |
| Styling | NativeWind v4 / Tailwind |
| Local state | React context (settings/auth); board interaction hooks |
| Server state | TanStack Query |
| Backend | Supabase (Postgres, Auth incl. Anonymous, Realtime, Edge Functions, pg_cron, pg_net) |
| Chess logic | chess.js (server: `submit-move`; client: redacted FEN + optimistic UI only) |
| Storage | AsyncStorage (auth session, settings) |
| Package manager | pnpm `9.12.3` (`packageManager` field; EAS profiles pin the same) |
| Builds | EAS (`eas.json` profiles + channels); env via `env.js` + `APP_ENV` |

## Project layout (important paths)

```
src/
  api/          # supabase client, server game/user APIs, auth
  app/          # Expo Router screens (sole router root)
  components/   # board, local-game, profile, how-to-play, ui
  lib/          # game pure modules, hooks, notifications, state queries
  types/        # shared types
supabase/
  schemas/      # declarative SQL sources
  migrations/   # currently one squashed file: 20260803000000_initial_schema.sql
  functions/    # submit-move edge function
  tests/database/  # pgTAP (redact_fen / player_views)
docs/adr/       # 0001–0007
```

## Env & app identity

- Files: `.env.development`, `.env.production`, (needed) `.env.staging` — gitignored via `.env*.{development,production,staging}`.
- Template: `.env.example` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`, `IOS_URL_SCHEMA`, `GOOGLE_WEB_CLIENT_ID`).
- `env.js` loads `.env.${APP_ENV}` (default `development`); EAS sets `APP_ENV` + `EXPO_NO_DOTENV=1` per profile.
- Bundle ID / Android package: `app.ghostchess` (with env suffix for non-production via `withEnvSuffix`).
- Android: `googleServicesFile: './google-services.json'` (file gitignored; provide locally / via EAS secrets). Same for `GoogleService-Info.plist` / Firebase admin JSON.

## EAS profiles (`eas.json`)

| Profile | Channel | Distribution | Notes |
|---------|---------|--------------|--------|
| production | production | store | AAB, `autoIncrement`, `APP_ENV=production` |
| staging | staging | internal | APK, `APP_ENV=staging` |
| development | development | internal | `developmentClient: true` |
| simulator | simulator | internal | iOS simulator; `APP_ENV=development` |

CLI: `version >= 16.24.1`, `appVersionSource: remote`.

## Dev setup

- Node LTS, pnpm, Watchman; Xcode / Android tooling as needed.
- `pnpm install` → `pnpm ios` / `pnpm android` / `pnpm dev`.
- Typecheck: `pnpm type-check`; unit: `pnpm test` / `pnpm test:ci`; DB: `pnpm test:db` (local Supabase + pgTAP).
- CI workflows are largely `workflow_dispatch`-only today.

## Constraints

- Primary platforms: iOS + Android; web secondary.
- New Architecture enabled (`newArchEnabled: true`).
- Information-hiding is a security constraint — client/network leaks of true position during `active` are bugs.
- Dual-implementation pattern: TS pure modules mirror SQL/Deno enforcement (`redact-fen`, `decide-move`, deadline, notification helpers) for unit tests; Postgres/edge remain authoritative.
