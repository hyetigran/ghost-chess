import * as React from 'react';
import { Audio } from 'expo-av';
import type { Square } from 'chess.js';
import { useSettings } from '~/context/settings-context';

// Synthesized in-repo (no sampled/licensed audio): a short wooden "tock"
// for a move, a lower "thud" for a capture, a flat two-blip "buzz" for a
// rejected move, and a short falling three-note sting for the game
// actually ending. See scripts/gen-sfx.js for how illegal.wav/game-over.wav
// were generated (kept for future sound tweaks, not run automatically).
const MOVE_SOUND = require('../../../assets/sounds/move.wav');
const CAPTURE_SOUND = require('../../../assets/sounds/capture.wav');
const ILLEGAL_SOUND = require('../../../assets/sounds/illegal.wav');
const GAME_OVER_SOUND = require('../../../assets/sounds/game-over.wav');

// A capture is detected one render *after* the position update that
// caused it (use-capture-flash waits for the next player_views row), so
// a position change can't know synchronously whether it deserves the
// move or the capture sound. The move sound therefore waits this long,
// and an arriving capture flash upgrades it — the delay is below
// perceptual latency for a UI confirmation sound.
const CAPTURE_UPGRADE_WINDOW_MS = 60;

// The one game-ending result that gets its own sting (#80). 'draw' /
// 'abandoned' (resignation) / 'timeout' endings are already communicated
// by the game-over modal's text and deliberately stay silent here — a
// king capture is the one ending abrupt enough (it can land on a move the
// opponent otherwise wouldn't have flagged as significant) to warrant an
// audible cue of its own. Compared against a plain string rather than a
// shared result union: local pass-and-play (LocalGameResult), the AI
// surface (also LocalGameResult), and the online game (GameResult) each
// have their own slightly different result type, and this hook only ever
// cares about this one literal.
const KING_CAPTURED_RESULT = 'king_captured';

/**
 * Plays a move/capture/illegal-move/game-over sound in response to game
 * events, honoring the settings sound toggle. See CONTEXT.md's "Move
 * rejection" and "King capture" entries — this hook is deliberately built
 * so neither new sound can leak information ADR-0007/ADR-0009 say must
 * stay hidden (see each param's doc below).
 *
 * `liveFen` must be the *live* game position, or null whenever sounds
 * would be wrong: game over (reveal re-renders aren't moves), history
 * browsing (pass the live fen, not the display fen), or not yet loaded.
 * Nothing plays on mount or when `liveFen` transitions from/to null —
 * only on an actual position-to-position change.
 *
 * `flashSquare` (online game only) upgrades the pending move sound to
 * the capture sound; surfaces without capture detection just get the
 * move sound for every move.
 *
 * `rejectionPulse`, if given, must change (e.g. an incrementing counter)
 * every time — and only when — a move attempt was rejected, from
 * whichever single uniform rejection path the caller already has (the
 * online game's mutation `onError`, or local/AI's "outcome wasn't legal"
 * branch). This hook does not, and must not, know *why* a given pulse
 * fired: it plays the exact same clip regardless, which is what keeps it
 * compliant with ADR-0007 (the server itself gives no signal about why a
 * move was illegal — including one that only looked legal because it
 * targeted a hidden opponent piece — and this hook can't be the place
 * that quietly reintroduces that signal by branching on a reason).
 *
 * `result`, if given, plays the game-over sting the render it first
 * becomes `'king_captured'` (any other value, including transitioning
 * back to null, is silent here — see KING_CAPTURED_RESULT above). Unlike
 * `liveFen`, this deliberately does *not* try to suppress the case where
 * a caller mounts directly into an already-completed game (e.g.
 * navigating straight to a finished game's page): `result` starts null
 * both while a game is genuinely in progress and before its data has
 * loaded, so those two cases can't be told apart from in here, and
 * GameOverModal (the caller-side game-over popup this pairs with) already
 * doesn't try to either — landing on a finished game's page always pops
 * that modal, so this sound following the same "you've arrived at a
 * finished game" rule is consistent, not a bug. This is a post-hoc "the
 * game is over" cue only, decided after the result already exists — it is
 * never a mid-game "your king is in danger" cue, which would leak
 * information no player is ever told (CONTEXT.md's "King capture" entry,
 * ADR-0009): there is no check concept in this game, and this hook has no
 * code path that could imitate one.
 */
export function useGameSounds(
  liveFen: string | null,
  flashSquare: Square | null = null,
  rejectionPulse = 0,
  result: string | null = null,
): void {
  const { soundEnabled } = useSettings();
  const soundsRef = React.useRef<{
    move: Audio.Sound | null;
    capture: Audio.Sound | null;
    illegal: Audio.Sound | null;
    gameOver: Audio.Sound | null;
  }>({ move: null, capture: null, illegal: null, gameOver: null });
  const pendingMoveSoundRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const loaded: Audio.Sound[] = [];
    void (async () => {
      // Audio is best-effort everywhere in this hook: a device with no
      // audio session, a web tab that hasn't had a user gesture yet, or
      // a failed asset load should degrade to silence, never to a
      // visible error in a chess game.
      try {
        const [move, capture, illegal, gameOver] = await Promise.all([
          Audio.Sound.createAsync(MOVE_SOUND),
          Audio.Sound.createAsync(CAPTURE_SOUND),
          Audio.Sound.createAsync(ILLEGAL_SOUND),
          Audio.Sound.createAsync(GAME_OVER_SOUND),
        ]);
        loaded.push(move.sound, capture.sound, illegal.sound, gameOver.sound);
        if (cancelled) return;
        soundsRef.current = {
          move: move.sound,
          capture: capture.sound,
          illegal: illegal.sound,
          gameOver: gameOver.sound,
        };
      } catch {
        // leave soundsRef null — play() becomes a no-op
      }
    })();
    return () => {
      cancelled = true;
      soundsRef.current = {
        move: null,
        capture: null,
        illegal: null,
        gameOver: null,
      };
      for (const sound of loaded) {
        void sound.unloadAsync().catch(() => {});
      }
      if (pendingMoveSoundRef.current) {
        clearTimeout(pendingMoveSoundRef.current);
        pendingMoveSoundRef.current = null;
      }
    };
  }, []);

  const play = (which: 'move' | 'capture' | 'illegal' | 'gameOver'): void => {
    void soundsRef.current[which]?.replayAsync().catch(() => {});
  };

  const previousFenRef = React.useRef(liveFen);
  React.useEffect(() => {
    const previous = previousFenRef.current;
    previousFenRef.current = liveFen;
    if (!soundEnabled || !liveFen || !previous || previous === liveFen) return;
    pendingMoveSoundRef.current = setTimeout(() => {
      pendingMoveSoundRef.current = null;
      play('move');
    }, CAPTURE_UPGRADE_WINDOW_MS);
  }, [liveFen, soundEnabled]);

  React.useEffect(() => {
    if (!flashSquare || !soundEnabled) return;
    if (pendingMoveSoundRef.current) {
      clearTimeout(pendingMoveSoundRef.current);
      pendingMoveSoundRef.current = null;
    }
    play('capture');
  }, [flashSquare, soundEnabled]);

  // Skips the initial render deliberately (previousPulseRef starts at
  // whatever `rejectionPulse` already was) — a caller that mounts with a
  // nonzero pulse for some unrelated reason still shouldn't hear a reject
  // sound for a rejection that predates this hook existing.
  const previousPulseRef = React.useRef(rejectionPulse);
  React.useEffect(() => {
    const previous = previousPulseRef.current;
    previousPulseRef.current = rejectionPulse;
    if (!soundEnabled || rejectionPulse === previous) return;
    play('illegal');
  }, [rejectionPulse, soundEnabled]);

  const previousResultRef = React.useRef(result);
  React.useEffect(() => {
    const previous = previousResultRef.current;
    previousResultRef.current = result;
    if (
      !soundEnabled ||
      result !== KING_CAPTURED_RESULT ||
      previous === result
    ) {
      return;
    }
    play('gameOver');
  }, [result, soundEnabled]);
}
