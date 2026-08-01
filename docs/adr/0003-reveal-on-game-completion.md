# Reveal the true board once a game completes

The PRD lists game `status` as `active | completed | abandoned` but doesn't say what a player sees once a game leaves `active`. Given [ADR-0001](./0001-server-side-redaction.md) and [ADR-0002](./0002-shadow-table-for-redacted-views.md), the redaction trigger needed an explicit answer here or it would default to filtering forever by omission.

We decided redaction lifts once a game is no longer active: `player_views` (or the equivalent final read) shows the true final position to both players. We rejected keeping the board hidden forever — the PRD's planned "advanced statistics and analysis" feature (§7.1) assumes players can review what actually happened, and permanent occlusion has no stated rationale behind it.
