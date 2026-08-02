-- Tests the real public.redact_fen SQL function directly (#30 task 3) —
-- src/lib/game/redact-fen.test.ts tests the TS mirror, which its own
-- doc comment says is "not a substitute for" this, the actual
-- enforcement point (docs/adr/0001, docs/adr/0002). Cases mirror that
-- test file's, against the real function this time.
begin;
select plan(11);

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
    public.redact_fen('RpR5/8/8/8/8/8/8/8 w - - 0 1', 'white'),
    'R1R5/8/8/8/8/8/8/8 w - - 0 1',
    'collapses two separate own-piece runs around a hidden opponent piece'
);

select is(
    public.redact_fen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'white'),
    '8/8/8/8/8/8/8/R3K2R w KQ - 0 1',
    'drops the opponent half of castling rights (white)'
);

select is(
    public.redact_fen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'black'),
    'r3k2r/8/8/8/8/8/8/8 w kq - 0 1',
    'drops the opponent half of castling rights (black)'
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
    public.redact_fen('8/8/8/8/8/8/8/8 b - - 12 34', 'white'),
    '8/8/8/8/8/8/8/8 b - - 0 34',
    'passes through active color and fullmove number unchanged'
);

-- A nonzero halfmove clock means the opponent's last move was a pawn move
-- or capture; passing it through would let a viewer detect a hidden pawn
-- move just by watching the clock reset.
select is(
    public.redact_fen('8/8/8/8/8/8/8/8 w - - 7 10', 'white'),
    '8/8/8/8/8/8/8/8 w - - 0 10',
    'always redacts the halfmove clock to 0, regardless of the true value'
);

select * from finish();
rollback;
