import * as React from 'react';
import { Audio } from 'expo-av';
import type { Square } from 'chess.js';
import { useSettings } from '~/context/settings-context';

// Synthesized in-repo (no sampled/licensed audio): a short wooden "tock"
// for a move, a lower "thud" for a capture.
const MOVE_SOUND = require('../../../assets/sounds/move.wav');
const CAPTURE_SOUND = require('../../../assets/sounds/capture.wav');

// A capture is detected one render *after* the position update that
// caused it (use-capture-flash waits for the next player_views row), so
// a position change can't know synchronously whether it deserves the
// move or the capture sound. The move sound therefore waits this long,
// and an arriving capture flash upgrades it — the delay is below
// perceptual latency for a UI confirmation sound.
const CAPTURE_UPGRADE_WINDOW_MS = 60;

/**
 * Plays a move/capture sound when the live position changes, honoring
 * the settings sound toggle.
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
 */
export function useGameSounds(
  liveFen: string | null,
  flashSquare: Square | null = null,
): void {
  const { soundEnabled } = useSettings();
  const soundsRef = React.useRef<{
    move: Audio.Sound | null;
    capture: Audio.Sound | null;
  }>({ move: null, capture: null });
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
        const [move, capture] = await Promise.all([
          Audio.Sound.createAsync(MOVE_SOUND),
          Audio.Sound.createAsync(CAPTURE_SOUND),
        ]);
        loaded.push(move.sound, capture.sound);
        if (cancelled) return;
        soundsRef.current = { move: move.sound, capture: capture.sound };
      } catch {
        // leave soundsRef null — play() becomes a no-op
      }
    })();
    return () => {
      cancelled = true;
      soundsRef.current = { move: null, capture: null };
      for (const sound of loaded) {
        void sound.unloadAsync().catch(() => {});
      }
      if (pendingMoveSoundRef.current) {
        clearTimeout(pendingMoveSoundRef.current);
        pendingMoveSoundRef.current = null;
      }
    };
  }, []);

  const play = (which: 'move' | 'capture'): void => {
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
}
