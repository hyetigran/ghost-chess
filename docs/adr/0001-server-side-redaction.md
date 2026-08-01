# Server-side redaction of hidden game state

Ghost Chess's entire premise depends on absolute occlusion of the opponent's pieces (see [Visibility](../../CONTEXT.md)). The current implementation stores one true FEN per game row and returns it directly to clients (`getGame` in `src/api/game/client.ts` runs `select('*')`), which means any player can read the true board position off the network regardless of what the UI renders.

We decided the server is solely responsible for enforcing visibility. Raw rows containing the true board state must never be returned to game clients — every read is redacted to "what this specific player is currently allowed to see" before it leaves the server. Client-side-only hiding was rejected because it's trivially defeated (dev tools, network inspection) and contradicts the anti-cheat goals already stated in the PRD.
