# Tech Context — Ghost Chess

## Stack

| Layer | Choice |
|-------|--------|
| App | Expo ~52, React Native 0.76, Expo Router ~4 |
| Language | TypeScript |
| Styling | NativeWind v4 / Tailwind |
| Local state | Zustand |
| Server state | TanStack Query + react-query-kit |
| Backend | Supabase (Postgres, Auth, Realtime) |
| Chess logic (target) | chess.js |
| Storage | react-native-mmkv |
| Package manager | pnpm (enforced via only-allow) |
| Builds | EAS (`eas.json`), env via `env.js` + `APP_ENV` |

## Project layout (important paths)

```
src/
  api/          # axios / supabase clients, game API
  app/          # Expo Router screens
  components/   # Auth, settings, shared UI
  lib/          # auth, game helpers, i18n, hooks, storage
  types/        # shared types (e.g. game.ts)
supabase/       # schema.ts, config (legacy guest scheme still present)
docs/adr/       # architecture decision records 0001–0007
app/            # parallel starter routes (react-native-reusables) — transitional
components/     # root-level UI kit (ThemeToggle, ui/*)
```

## Dev setup

- Node LTS, pnpm, Watchman (macOS/Linux), Xcode/Android tooling as needed.
- `pnpm install` → `pnpm ios` / `pnpm android` / `pnpm start`.
- Env files: `.env.development`, `.env.production` (do not commit secrets).
- Typecheck: `pnpm type-check`; tests: `pnpm test`; e2e: Maestro (`pnpm e2e-test`).

## Known dependency gaps (vs target architecture)

Per `ARCHITECTURE.md` implementation status:

- `chess.js` not yet in `package.json`.
- `@supabase/supabase-js` used in code (`src/utils/supabase.ts`) — verify declared deps when migrating.
- `player_views` table / redaction triggers not implemented.
- Schema still uses dual guest-id columns + `guest_conversions` + `set_guest_id`.

## Constraints

- Primary platforms: iOS + Android; web secondary later.
- New Architecture enabled (`newArchEnabled: true` in app config).
- Bundle IDs / package names driven by `Env` in `env.js`.
- Information-hiding is a security constraint, not just UX — treat leaks as bugs.
