// Server-side move-validation path, ADR-0007 (docs/adr/0007-constant-time-move-rejection.md).
// This is the only place a move is ever accepted: clients never write to
// games/moves directly (see ADR-0001, ADR-0012's fix). Every illegal-move
// rejection — not a participant, not your turn, game not active, or
// chess.js rejects the move — returns the exact same { error: "illegal_move" }
// shape via the same code path, so content and timing stay indistinguishable
// regardless of *why* a move failed (CONTEXT.md's Move rejection entry).
//
// The move-legality decision itself mirrors src/lib/game/decide-move.ts,
// which is Jest-tested and kept in lockstep with the logic below — that
// file is the readable, unit-tested reference; this function is the actual
// enforcement point, since it alone can see the true, unredacted game row.
// The two can't share a single source file without fragile cross-directory
// Deno import resolution (this function runs in an isolated Deno runtime,
// not the RN app's Metro/Node module graph), so — same as ADR-0002's
// redact_fen/redact-fen.ts pair — the duplication is deliberate.
//
// Authorization/rate-limiting responses (401/429) ARE allowed to differ
// from the illegal-move response and from each other: neither discloses
// anything about hidden board state, which is the only thing ADR-0007
// requires staying uniform. A nonexistent gameId is NOT given its own
// response — see illegalMoveResponse()'s call site below.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Chess } from 'npm:chess.js@1.1.0';

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_ATTEMPTS = 30;

type SubmitMoveRequest = {
  gameId: string;
  from: string;
  to: string;
  promotion?: string;
};

// games.id and move_attempts.game_id are both uuid columns. Without this
// check, a non-UUID gameId makes the move_attempts insert below fail with
// Postgres error 22P02 — silently, since that insert only logs its error
// rather than blocking on it — so a caller who always sends a malformed
// gameId would never increment their own rate-limit counter. Validating
// the shape up front (alongside from/to) keeps this on the same
// information-free code path as every other malformed-request case.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type GameRow = {
  id: string;
  fen: string;
  current_turn: 'white' | 'black';
  status: 'waiting' | 'active' | 'completed' | 'abandoned';
  white_player_id: string | null;
  black_player_id: string | null;
  updated_at: string;
  white_time_remaining: number;
  black_time_remaining: number;
};

// A Fetch Response body is single-use, and Deno's production runtime
// reuses the same module-scope isolate across requests (unlike the local
// `--no-verify-jwt` dev server's "oneshot" policy, which re-evaluates the
// module per request and would never have caught this) — a module-scope
// singleton Response would throw "body already consumed" on its second
// use. Must be a fresh Response per call.
function illegalMoveResponse(): Response {
  return new Response(JSON.stringify({ error: 'illegal_move' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Scoped to the caller's own JWT, used only to establish identity.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await callerClient.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Bypasses RLS: this function is the trusted boundary that's allowed to
  // see the true, unredacted game state and to call apply_move.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let body: SubmitMoveRequest;
  try {
    body = await req.json();
  } catch {
    return illegalMoveResponse();
  }
  if (
    typeof body?.gameId !== 'string' ||
    !UUID_PATTERN.test(body.gameId) ||
    typeof body?.from !== 'string' ||
    typeof body?.to !== 'string'
  ) {
    return illegalMoveResponse();
  }

  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000,
  ).toISOString();
  const { count: recentAttempts, error: rateLimitError } = await adminClient
    .from('move_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', user.id)
    .gte('created_at', windowStart);

  // A failed count silently disables the rate limit for this request
  // (recentAttempts stays undefined, ?? 0 always passes) — this is exactly
  // the class of failure a missing grant caused for player_views in #11,
  // so it's worth logging even though (like the attempt-log insert below)
  // it doesn't block the request.
  if (rateLimitError) {
    console.error('rate-limit query failed:', rateLimitError.message);
  }

  if ((recentAttempts ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Logged regardless of outcome — an illegal-move spam attempt counts
  // against the limit exactly like a legal one (defense in depth, ADR-0007).
  // A logging failure doesn't block the move itself (rate-limit
  // availability isn't worth making a hard dependency of gameplay), but is
  // worth surfacing rather than failing silently.
  const { error: attemptLogError } = await adminClient
    .from('move_attempts')
    .insert({ player_id: user.id, game_id: body.gameId });
  if (attemptLogError) {
    console.error('failed to log move attempt:', attemptLogError.message);
  }

  const { data: game } = await adminClient
    .from('games')
    .select(
      'id, fen, current_turn, status, white_player_id, black_player_id, updated_at, white_time_remaining, black_time_remaining',
    )
    .eq('id', body.gameId)
    .maybeSingle<GameRow>();

  // Full SAN history, oldest first — needed to correctly detect threefold
  // repetition (a bare `new Chess(fen)` has no memory of earlier
  // occurrences of the same position; see decide-move.ts's matching
  // comment) and to compute move_number without a second, separately-run
  // query that the games fetch above could race against.
  const { data: priorMoves } = await adminClient
    .from('moves')
    .select('move_text')
    .eq('game_id', body.gameId)
    .order('move_number', { ascending: true });
  const moveHistory = (priorMoves ?? []).map((m) => m.move_text as string);

  // A nonexistent gameId is folded into the same uniform illegal-move
  // response rather than a distinct 404: a 404 returned before any
  // chess.js/participant work would confirm which game IDs are real,
  // which is a disclosure ADR-0007 doesn't carve out an exception for
  // (unlike auth/rate-limit, this is about the game itself, not just
  // request-level bookkeeping). Falling back to the starting position
  // keeps the chess.js call — and therefore the timing profile — the same
  // shape as the real-game path; `legal` still forces false via `!game`.
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const callerColor: 'white' | 'black' | null = game
    ? game.white_player_id === user.id
      ? 'white'
      : game.black_player_id === user.id
        ? 'black'
        : null
    : null;

  // Replay history rather than loading game.fen directly, same reasoning
  // as decide-move.ts's buildChessFromHistory: an empty history (a fresh
  // game, or the not-found fallback above) is equivalent to loading the
  // fen/start position directly, so this doesn't change behavior for
  // those cases.
  const chess =
    moveHistory.length === 0
      ? new Chess(game?.fen ?? START_FEN)
      : new Chess();
  try {
    for (const san of moveHistory) {
      chess.move(san);
    }
  } catch {
    // Replay failed on defensive, shouldn't-happen input (moveHistory is
    // DB-sourced from moves apply_move itself wrote) — fall back to the
    // true fen so the request can still be handled, just without
    // repetition detection for this call.
    chess.load(game?.fen ?? START_FEN);
  }

  // deno-lint-ignore no-explicit-any
  let moveResult: any = null;
  try {
    moveResult = chess.move({
      from: body.from,
      to: body.to,
      promotion: body.promotion,
    });
  } catch {
    moveResult = null;
  }

  const legal =
    game !== null &&
    game !== undefined &&
    game.status === 'active' &&
    callerColor !== null &&
    callerColor === game.current_turn &&
    moveResult !== null;

  if (!legal || !callerColor || !game) {
    return illegalMoveResponse();
  }

  const elapsedSeconds = Math.max(
    0,
    (Date.now() - new Date(game.updated_at).getTime()) / 1000,
  );
  const whiteTimeRemaining =
    callerColor === 'white'
      ? Math.max(0, Math.round(game.white_time_remaining - elapsedSeconds))
      : game.white_time_remaining;
  const blackTimeRemaining =
    callerColor === 'black'
      ? Math.max(0, Math.round(game.black_time_remaining - elapsedSeconds))
      : game.black_time_remaining;

  let status: GameRow['status'] = 'active';
  let result: 'checkmate' | 'stalemate' | 'draw' | null = null;
  let winnerId: string | null = null;

  if (chess.isCheckmate()) {
    status = 'completed';
    result = 'checkmate';
    winnerId = user.id;
  } else if (chess.isStalemate()) {
    status = 'completed';
    result = 'stalemate';
  } else if (chess.isDraw()) {
    status = 'completed';
    result = 'draw';
  }

  // p_expected_fen (not a move number computed here) is what makes this
  // call concurrency-safe — see apply_move's doc comment
  // (supabase/schemas/06_functions.sql). move_number is computed inside
  // that same function, from the same transaction that checks this
  // precondition, not from the moveHistory query above (which could itself
  // be stale by the time this call lands).
  const { error: applyError } = await adminClient.rpc('apply_move', {
    p_game_id: body.gameId,
    p_player_id: user.id,
    p_expected_fen: game.fen,
    p_move_text: moveResult.san,
    p_new_fen: chess.fen(),
    p_captured_piece: moveResult.captured ?? null,
    p_new_current_turn: chess.turn() === 'w' ? 'white' : 'black',
    p_is_check: chess.isCheck(),
    p_status: status,
    p_result: result,
    p_winner_id: winnerId,
    p_white_time_remaining: whiteTimeRemaining,
    p_black_time_remaining: blackTimeRemaining,
  });

  if (applyError?.message?.includes('stale_precondition')) {
    // Another move landed between our read and this call (e.g. a
    // double-submit). Not a server bug and not a special case worth its
    // own response — from the caller's perspective this move, evaluated
    // against a position that's no longer current, is simply no longer
    // valid, so it gets the same uniform rejection as any other illegal
    // move.
    return illegalMoveResponse();
  }

  if (applyError) {
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
