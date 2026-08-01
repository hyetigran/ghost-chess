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
// Authorization/rate-limiting/not-found responses (401/429/404) ARE allowed
// to differ from the illegal-move response and from each other: none of
// them disclose anything about hidden board state, which is the only thing
// ADR-0007 requires staying uniform.
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

const ILLEGAL_MOVE_RESPONSE = new Response(
  JSON.stringify({ error: 'illegal_move' }),
  { status: 400, headers: { 'Content-Type': 'application/json' } },
);

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
    return ILLEGAL_MOVE_RESPONSE;
  }
  if (!body?.gameId || !body?.from || !body?.to) {
    return ILLEGAL_MOVE_RESPONSE;
  }

  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000,
  ).toISOString();
  const { count: recentAttempts } = await adminClient
    .from('move_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', user.id)
    .gte('created_at', windowStart);

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

  const { data: game, error: gameError } = await adminClient
    .from('games')
    .select(
      'id, fen, current_turn, status, white_player_id, black_player_id, updated_at, white_time_remaining, black_time_remaining',
    )
    .eq('id', body.gameId)
    .maybeSingle<GameRow>();

  if (gameError || !game) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const callerColor: 'white' | 'black' | null =
    game.white_player_id === user.id
      ? 'white'
      : game.black_player_id === user.id
        ? 'black'
        : null;

  const chess = new Chess(game.fen);
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
    game.status === 'active' &&
    callerColor !== null &&
    callerColor === game.current_turn &&
    moveResult !== null;

  if (!legal || !callerColor) {
    return ILLEGAL_MOVE_RESPONSE;
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

  const { count: moveCount } = await adminClient
    .from('moves')
    .select('id', { count: 'exact', head: true })
    .eq('game_id', body.gameId);

  const { error: applyError } = await adminClient.rpc('apply_move', {
    p_game_id: body.gameId,
    p_player_id: user.id,
    p_move_number: (moveCount ?? 0) + 1,
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
