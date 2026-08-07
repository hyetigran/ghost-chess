// Server-side move-validation path, ADR-0007 (docs/adr/0007-constant-time-move-rejection.md).
// This is the only place a move is ever accepted: clients never write to
// games/moves directly (see ADR-0001, ADR-0012's fix). Every illegal-move
// rejection — not a participant, not your turn, game not active, or the
// move isn't pseudo-legal — returns the exact same { error: "illegal_move" }
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

// deno-lint-ignore no-explicit-any
type ChessInstance = any;

// ---------------------------------------------------------------------
// Pseudo-legal move helpers — hand-kept-in-lockstep Deno copy of
// src/lib/game/pseudo-legal-moves.ts (same cross-runtime-boundary
// reasoning as the redact_fen/decide-move.ts duplication above). See that
// file's header comment for the full rationale: under Fog of War
// (ADR-0009) a move that leaves the mover's own king in check is legal,
// and capturing the enemy king ends the game — chess.js's public API
// refuses both, so this relies on its private `_moves({legal:false})` /
// `_makeMove` / `_moveToSan` / `_incPositionCount` internals instead.
// pseudo-legal-moves.test.ts carries the canary test that would catch a
// chess.js upgrade silently breaking this; if that ever fails, re-verify
// this copy against the same spike before trusting either one again.
// ---------------------------------------------------------------------

function algebraicFromIndex(index: number): string {
  const file = index & 0xf;
  const rank = index >> 4;
  return (('abcdefgh'[file] ?? '') + '87654321'[rank]) as string;
}

type PseudoLegalMove = {
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
  san: string;
};

function toPseudoLegalMove(
  chess: ChessInstance,
  move: ChessInstance,
  allMoves: ChessInstance[],
): PseudoLegalMove {
  const rawSan = chess._moveToSan(move, allMoves);
  return {
    from: algebraicFromIndex(move.from),
    to: algebraicFromIndex(move.to),
    piece: move.piece,
    captured: move.captured,
    promotion: move.promotion,
    san: rawSan.replace(/[+#]$/, ''),
  };
}

function pseudoLegalMoves(chess: ChessInstance): PseudoLegalMove[] {
  const all = chess._moves({ legal: false });
  return all.map((m: ChessInstance) => toPseudoLegalMove(chess, m, all));
}

function commitMove(
  chess: ChessInstance,
  match: ChessInstance,
  all: ChessInstance[],
): PseudoLegalMove {
  const outcome = toPseudoLegalMove(chess, match, all);
  chess._makeMove(match);
  chess._incPositionCount(chess.fen());
  return outcome;
}

function applyPseudoLegalMove(
  chess: ChessInstance,
  attempt: { from: string; to: string; promotion?: string },
): PseudoLegalMove | null {
  const all = chess._moves({ legal: false });
  const wantPromotion = attempt.promotion ?? 'q';
  const match = all.find(
    (m: ChessInstance) =>
      algebraicFromIndex(m.from) === attempt.from &&
      algebraicFromIndex(m.to) === attempt.to &&
      (m.promotion === undefined || m.promotion === wantPromotion),
  );
  if (!match) return null;
  return commitMove(chess, match, all);
}

function applyPseudoLegalSan(
  chess: ChessInstance,
  san: string,
): PseudoLegalMove | null {
  const all = chess._moves({ legal: false });
  const match = all.find(
    (m: ChessInstance) =>
      chess._moveToSan(m, all).replace(/[+#]$/, '') === san,
  );
  if (!match) return null;
  return commitMove(chess, match, all);
}

function wasKingCaptured(move: PseudoLegalMove): boolean {
  return move.captured === 'k';
}

// ---------------------------------------------------------------------

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
  // Doubles as "when did the current player's turn start" (docs/adr/0006)
  // — set to now() on every accepted move, so the per-move deadline is
  // this plus the game's time control window.
  updated_at: string;
  settings: { timeControlHours: 1 | 12 | 24 };
};

// Mirrors src/lib/game/deadline.ts's isDeadlineLapsed — same
// dual-implementation reasoning as decide-move.ts/redact_fen (this
// function runs in an isolated Deno runtime and can't cleanly import
// across that boundary).
function isDeadlineLapsed(
  turnStartedAt: string,
  timeControlHours: 1 | 12 | 24,
  now: number,
): boolean {
  const deadline =
    new Date(turnStartedAt).getTime() + timeControlHours * 60 * 60 * 1000;
  return now >= deadline;
}

// A Fetch Response body is single-use, and Deno's production runtime
// reuses the same module-scope isolate across requests (unlike the local
// `--no-verify-jwt` dev server's "oneshot" policy, which re-evaluates the
// module per request and would never have caught this) — a module-scope
// singleton Response would throw "body already consumed" on its second
// use. Must be a fresh Response per call.
// Every response below needs these, not just the OPTIONS preflight
// reply — a browser blocks JS from reading even a successful response if
// it lacks Access-Control-Allow-Origin, since `supabase.functions.invoke`
// always sends `Content-Type: application/json`, which makes every call
// here a "non-simple" request the browser preflights. This was missing
// entirely until now, so no move submitted through a real browser (as
// opposed to curl, or Jest/psql calling the underlying RPC directly,
// neither of which enforce CORS) could ever have succeeded — the
// preflight OPTIONS request itself was falling through to the
// method-not-allowed branch below and failing before the real POST was
// ever sent.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function illegalMoveResponse(): Response {
  return new Response(JSON.stringify({ error: 'illegal_move' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
      'id, fen, current_turn, status, white_player_id, black_player_id, updated_at, settings',
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
  // legality work would confirm which game IDs are real, which is a
  // disclosure ADR-0007 doesn't carve out an exception for (unlike
  // auth/rate-limit, this is about the game itself, not just
  // request-level bookkeeping). Falling back to the starting position
  // keeps the move-attempt call — and therefore the timing profile — the
  // same shape as the real-game path; `legal` still forces false via
  // `!game`.
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const callerColor: 'white' | 'black' | null = game
    ? game.white_player_id === user.id
      ? 'white'
      : game.black_player_id === user.id
        ? 'black'
        : null
    : null;

  // Replay history via applyPseudoLegalSan rather than the public
  // chess.move(san) — same reasoning as decide-move.ts's
  // buildChessFromHistory: under Fog of War a historical move may be one
  // the public API's check-safety filter would refuse to recognize. An
  // empty history (a fresh game, or the not-found fallback above) loads
  // fen/start position directly instead, equivalent for those cases.
  const chess: ChessInstance =
    moveHistory.length === 0
      ? new Chess(game?.fen ?? START_FEN)
      : new Chess();
  try {
    for (const san of moveHistory) {
      if (!applyPseudoLegalSan(chess, san)) {
        throw new Error(`unresolvable historical move: ${san}`);
      }
    }
  } catch {
    // Replay failed on defensive, shouldn't-happen input (moveHistory is
    // DB-sourced from moves apply_move itself wrote) — fall back to the
    // true fen so the request can still be handled, just without
    // repetition detection for this call.
    chess.load(game?.fen ?? START_FEN);
  }

  const moveResult = applyPseudoLegalMove(chess, {
    from: body.from,
    to: body.to,
    promotion: body.promotion,
  });

  // A lapsed deadline makes any move attempt too late, folded into the
  // same uniform `legal` boolean as every other rejection reason
  // (ADR-0007) rather than checked separately — see decide-move.ts's
  // matching comment. This doesn't itself end the game; that's
  // forfeit_lapsed_games' job (a scheduled job, since a client can't be
  // relied on to be open to trigger it, docs/adr/0006) — this just closes
  // the window between a deadline lapsing and that job's next tick, so a
  // move can never sneak through in it.
  const legal =
    game !== null &&
    game !== undefined &&
    game.status === 'active' &&
    callerColor !== null &&
    callerColor === game.current_turn &&
    !isDeadlineLapsed(
      game.updated_at,
      game.settings.timeControlHours,
      Date.now(),
    ) &&
    moveResult !== null;

  if (!legal || !callerColor || !game || !moveResult) {
    return illegalMoveResponse();
  }

  let status: GameRow['status'] = 'active';
  let result: 'king_captured' | 'draw' | null = null;
  let winnerId: string | null = null;

  if (wasKingCaptured(moveResult)) {
    status = 'completed';
    result = 'king_captured';
    winnerId = user.id;
  } else if (pseudoLegalMoves(chess).length === 0) {
    // Stalemate's replacement — see decide-move.ts's identical branch.
    status = 'completed';
    result = 'draw';
  } else if (
    chess.isThreefoldRepetition() ||
    chess.isInsufficientMaterial() ||
    chess.isDrawByFiftyMoves()
  ) {
    // Individually, not via the composite isDraw() — that still bundles
    // the now-removed stalemate concept.
    status = 'completed';
    result = 'draw';
  }

  // p_expected_fen (not a move number computed here) is what makes this
  // call concurrency-safe — see apply_move's doc comment
  // (supabase/schemas/08_functions.sql). move_number is computed inside
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
    p_status: status,
    p_result: result,
    p_winner_id: winnerId,
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
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});
