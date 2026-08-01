# Project Brief — Ghost Chess (Invisible Chess)

## What it is

Ghost Chess is a mobile chess variant where each player can see only their own pieces. Opponent pieces stay invisible for the whole active game (except briefly on capture). The game is memory, deduction, and standard chess rules under absolute occlusion.

## Goals

- Ship a playable Invisible Chess experience on iOS and Android (Expo / React Native).
- Enforce visibility **server-side** — clients never receive the true board while a game is active.
- Support guests as first-class online players (Supabase Anonymous Auth), convertible to registered accounts without losing identity or history.
- Preserve information-hiding for illegal moves: identical content and constant-time rejection so probing hidden squares leaks nothing.

## Non-goals (near term)

- Attack-based / fog-of-war reveal variants (different product).
- Web as primary platform (future secondary).
- Tournaments, social messaging, monetization (post-MVP).

## Success criteria

- Players can complete local, AI, and online games under occlusion rules from `PRD.md` / `CONTEXT.md`.
- Network inspection cannot reveal opponent positions during an active game.
- Guests can be invited/matched with real signed sessions (no bare client UUID as identity).

## Source-of-truth docs

| Doc | Role |
|-----|------|
| `PRD.md` | Product requirements |
| `CONTEXT.md` | Canonical domain glossary |
| `ARCHITECTURE.md` | Target technical picture |
| `docs/adr/` | Hard-to-reverse decisions (0001–0007) |
| `memory-bank/` | Working context for AI/agents across sessions |

## Roadmap phases (from PRD)

1. **MVP** — Core mechanics, basic UI, local play, simple AI  
2. **Online** — Accounts, matchmaking, persistence, basic social  
3. **Polish** — UX, advanced options, stats, more modes  
