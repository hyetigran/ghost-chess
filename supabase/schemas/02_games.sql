-- No white_time_remaining/black_time_remaining columns: per-move deadlines
-- (docs/adr/0006) don't have a continuously-depleting clock to persist per
-- side — there's exactly one relevant deadline at any moment (whoever's
-- turn it currently is), and it's fully derived from updated_at (already
-- set to now() on every accepted move/creation) plus
-- settings.timeControlHours. See src/lib/game/deadline.ts and
-- forfeit_lapsed_games() (06_functions.sql).
create table "public"."games" (
    "id" uuid not null default gen_random_uuid(),
    "white_player_id" uuid references public.users default null,
    "black_player_id" uuid references public.users default null,
    "settings" jsonb not null,
    "status" text not null check (status in ('waiting', 'active', 'completed', 'abandoned')),
    -- 'king_captured' replaces 'checkmate'/'stalemate' under Fog of War
    -- (ADR-0009, docs/adr/0009-king-capture-ends-the-game.md) — the game
    -- ends the instant a king is captured, not by checkmate detection.
    -- 'draw' now also covers the rare "the side to move has zero
    -- pseudo-legal moves" case that used to be 'stalemate', plus threefold
    -- repetition / insufficient material / the fifty-move rule, unchanged
    -- from before.
    "result" text check (result in ('king_captured', 'draw', 'abandoned', 'timeout', null)),
    "current_turn" text not null check (current_turn in ('white', 'black')),
    "fen" text not null,
    "pgn" text not null,
    "winner_id" uuid references public.users(id) default null,
    -- Open-invitation rating gate, set only when settings.isPrivate is
    -- false and the creator turned on "my rating class only" (#33). Both
    -- null means "open to anyone" — the implicit behavior for every game
    -- before this feature existed, including today's private-link games.
    -- Real columns rather than another settings jsonb key: join_game's
    -- eligibility check needs a plain WHERE-clause range comparison,
    -- which doesn't index well into jsonb the way a real column does.
    -- Derived once from the creator's elo_rating at post time and stored
    -- statically, not recomputed live — matches the mockup's fixed
    -- "Class D · 1200-1399" shown at post time rather than a filter that
    -- silently drifts as the creator's own rating changes later.
    "invitation_min_rating" integer default null,
    "invitation_max_rating" integer default null,
    -- Set once send_time_warnings() (06_functions.sql, #29) sends a
    -- deadline-approaching push for the *current* turn, so it doesn't
    -- re-send on every cron tick; cleared back to null by apply_move
    -- whenever a move actually lands, so the next turn gets its own fresh
    -- warning eligibility.
    "time_warning_sent_at" timestamp with time zone default null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    constraint "games_pkey" primary key ("id")
);
