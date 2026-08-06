-- Tests the real public.redact_fen SQL function directly (#30 task 3) —
-- src/lib/game/redact-fen.test.ts tests the TS mirror, which its own
-- doc comment says is "not a substitute for" this, the actual
-- enforcement point (docs/adr/0001, docs/adr/0002). Fixtures are shared
-- verbatim with that file where possible (Fog of War vision, ADR-0008) as
-- a cross-check that the two independent implementations agree.
begin;
select plan(17);

select is(
    public.redact_fen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'white'),
    '8/8/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1',
    'hides every opponent piece and keeps every own piece at the start position (white)'
);

select is(
    public.redact_fen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'black'),
    'rnbqkbnr/pppppppp/8/8/8/8/8/8 w kq - 0 1',
    'hides every opponent piece and keeps every own piece at the start position (black)'
);

select is(
    public.redact_fen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 'white'),
    '8/8/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQ - 0 1',
    'keeps own pieces visible on an otherwise-hidden rank'
);

select is(
    public.redact_fen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 'black'),
    'rnbqkbnr/pppppppp/8/8/8/8/8/8 b kq - 0 1',
    'hides an opponent piece and merges the surrounding empty squares'
);

select is(
    public.redact_fen('NnN5/8/8/8/8/8/8/K6k w - - 0 1', 'white'),
    'N1N5/8/8/8/8/8/8/K7 w - - 0 1',
    'collapses two separate own-piece runs around a hidden opponent piece'
);

select is(
    public.redact_fen('r3k2r/p6p/8/8/8/8/P6P/R3K2R w KQkq - 0 1', 'white'),
    '8/8/8/8/8/8/P6P/R3K2R w KQ - 0 1',
    'drops the opponent half of castling rights, no incidental vision between the back-rank rooks (white)'
);

select is(
    public.redact_fen('r3k2r/p6p/8/8/8/8/P6P/R3K2R w KQkq - 0 1', 'black'),
    'r3k2r/p6p/8/8/8/8/8/8 w kq - 0 1',
    'drops the opponent half of castling rights, no incidental vision between the back-rank rooks (black)'
);

select unalike(
    public.redact_fen('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3', 'white'),
    '%d6%',
    'always hides the en passant target square, regardless of viewer (white)'
);

select unalike(
    public.redact_fen('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3', 'black'),
    '%d6%',
    'always hides the en passant target square, regardless of viewer (black)'
);

select is(
    public.redact_fen('k7/8/8/3pP3/8/8/8/3R3K w - d6 0 3', 'white'),
    '8/8/8/3pP3/8/8/8/3R3K w - - 0 3',
    'hides the en passant target square even when the double-pushed pawn itself is now visible'
);

select is(
    public.redact_fen('7k/8/8/8/8/8/8/K7 b - - 12 34', 'white'),
    '8/8/8/8/8/8/8/K7 b - - 0 34',
    'passes through active color and fullmove number unchanged'
);

-- A nonzero halfmove clock means someone's last move was a pawn move or
-- capture, possibly on a square outside the viewer's vision; passing it
-- through would let a viewer detect that hidden activity just by watching
-- the clock reset.
select is(
    public.redact_fen('7k/8/8/8/8/8/8/K7 w - - 7 10', 'white'),
    '8/8/8/8/8/8/8/K7 w - - 0 10',
    'always redacts the halfmove clock to 0, regardless of the true value'
);

-- Fog of War vision (ADR-0008) — same fixtures as redact-fen.test.ts.
select is(
    public.redact_fen('r6k/8/8/8/8/8/8/R6K w - - 0 1', 'white'),
    'r7/8/8/8/8/8/8/R6K w - - 0 1',
    'reveals an enemy piece on an open file, up to and including the first blocker'
);

select is(
    public.redact_fen('r6k/p7/8/8/8/8/P7/R6K w - - 0 1', 'white'),
    '8/8/8/8/8/8/P7/R6K w - - 0 1',
    'does not reveal anything beyond the first blocker on a ray'
);

select is(
    public.redact_fen('7k/8/8/3pp3/4P3/8/8/K7 w - - 0 1', 'white'),
    '8/8/8/3p4/4P3/8/8/K7 w - - 0 1',
    'reveals a pawn only via its diagonal capture squares, never its forward push square'
);

select is(
    public.redact_fen('7k/8/8/1p1p4/3N4/8/8/K7 w - - 0 1', 'white'),
    '8/8/8/1p6/3N4/8/8/K7 w - - 0 1',
    'reveals a piece on a knight-reachable square and hides one that is not'
);

select is(
    public.redact_fen('k7/8/4p3/4p3/4K3/8/8/8 w - - 0 1', 'white'),
    '8/8/8/4p3/4K3/8/8/8 w - - 0 1',
    'reveals a piece adjacent to the viewer''s king and hides one two squares away'
);

select * from finish();
rollback;
