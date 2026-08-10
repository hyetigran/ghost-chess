# Project Brief — Ghost Chess (Fog of War Chess)

## What it is

Ghost Chess is a mobile chess variant where each player sees only their own pieces plus whichever enemy pieces their own pieces currently attack (ADR-0008) — everything else stays hidden, and there's no check/checkmate, only a game-ending king capture (ADR-0009). The game is memory, deduction, and standard chess piece movement under partial, attack-based occlusion rather than absolute occlusion. (Earlier in this project's life, occlusion was absolute — every opponent piece unconditionally hidden — before the Fog of War rewrite; see the ADRs above for why that changed.)

## Goals

- Ship a playable Fog of War Chess experience on iOS and Android (Expo / React Native).
- Enforce visibility **server-side** — clients never receive the true board while a game is active, and vision is delivered only through the existing redacted-state read/subscription path, never a new interactive "can I see square X" query (ADR-0007, ADR-0008).
- Support guests as first-class online players (Supabase Anonymous Auth), convertible to registered accounts without losing identity or history.
- Preserve information-hiding for illegal moves: identical content and constant-time rejection so probing hidden squares leaks nothing.

## Non-goals (near term)

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
| `docs/adr/` | Hard-to-reverse decisions (0001–0009) |
| `memory-bank/` | Working context for AI/agents across sessions |

## Roadmap phases (from PRD)

1. **MVP** — Fog of War core, board UI, local + AI — **landed** (ADR-0008/0009 rewrite included).
2. **Online** — Auth, private + open invitations, Realtime, rating Quick Match — **landed**. Push path built; device delivery unproven.
3. **Polish** — Promotion picker, sound, EAS device validation, ARCHITECTURE.md refresh, schema/TS drift cleanup, more modes.  
