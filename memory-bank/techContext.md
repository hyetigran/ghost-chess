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
| Chess logic | chess.js + custom pseudo-legal layer (FoW); server authoritative in `submit-move` |
| Storage | AsyncStorage (auth session, settings) |
| Package manager | pnpm `9.12.3` (EAS profiles pin the same) |
| Builds | EAS (`eas.json`); env via `env.js` + `APP_ENV` |

## Project layout (important paths)

```
src/
  api/          # supabase client, game/user/invitations/matchmaking APIs, auth
  app/          # Expo Router screens (home turn-queue, invitations, local/ai, …)
  components/   # board (fog overlay), home queue, new-game, matchmaking UI
  lib/          # game pure modules (redact, pseudo-legal, matchmaking-band, …)
  types/        # zod schemas (database.ts) — watch FoW field drift
supabase/
  schemas/      # 00_extensions … 10_matchmaking.sql
  migrations/   # squash + additive FoW / invitations / matchmaking
  functions/    # submit-move
  tests/database/  # pgTAP
docs/adr/       # 0001–0009
```

## Migrations (current chain)

1. `20260803000000_initial_schema.sql` — squashed baseline  
2. `20260803231538_add_player_view_identity.sql`  
3. `20260805231330_fog_of_war_rules_rewrite.sql` — ADR-0008/0009  
4. `20260806000000_open_invitations.sql`  
5. `20260806120000_matchmaking.sql`  

## Env & app identity

- `.env.development` / `.env.staging` / `.env.production` (gitignored); `.env.example` template.
- Keys: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`, `IOS_URL_SCHEMA`, `GOOGLE_WEB_CLIENT_ID`.
- Bundle / package: `app.ghostchess` (+ env suffix non-prod).
- Android `googleServicesFile: './google-services.json'` (gitignored).

## EAS profiles (`eas.json`)

| Profile | Channel | Distribution | Notes |
|---------|---------|--------------|--------|
| production | production | store | AAB, autoIncrement, `APP_ENV=production` |
| staging | staging | internal | APK, `APP_ENV=staging` |
| development | development | internal | developmentClient |
| simulator | simulator | internal | iOS simulator; `APP_ENV=development` |

`EXPO_NO_DOTENV=1` + `pnpm: 9.12.3` on profiles. CLI `>= 16.24.1`, `appVersionSource: remote`.

## Dev setup

- `pnpm install` → `pnpm ios` / `pnpm android` / `pnpm dev`.
- `pnpm type-check`; `pnpm test` / `test:ci`; `pnpm test:db`.
- CI largely `workflow_dispatch`-only.

## Constraints

- FoW + king-capture are product/security constraints, not cosmetics.
- Dual-implementation: TS mirrors for tests; SQL/Deno enforce.
- Private chess.js internals for pseudo-legal moves — canary tests must stay green across upgrades.
