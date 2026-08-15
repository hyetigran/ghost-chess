#!/usr/bin/env node
// One-off generator for assets/sounds/illegal.wav and
// assets/sounds/game-over.wav (#80) — synthesized in-repo (no
// sampled/licensed audio), matching the format of the existing
// move.wav/capture.wav: 16-bit mono PCM, 44100 Hz, standard 44-byte
// RIFF/WAVE header. Kept here (rather than deleted after the one run
// that produced the committed .wav files) in case these clips ever need
// retuning — re-run with `node scripts/gen-sfx.js` from the repo root;
// it overwrites the two files in place. Uses only Node built-ins
// (fs/path/Buffer), no new dependency for something this small.
'use strict';

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

function writeWav(filePath, samples) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate (mono, 16-bit)
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(samples[i], 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
  console.log(
    `${filePath}: ${buf.length} bytes, ${((samples.length / SAMPLE_RATE) * 1000).toFixed(0)}ms`,
  );
}

// Linear envelope helper: ramps 0->1 over `attackMs`, holds, then 1->0 over
// `releaseMs`, so every clip starts/ends at silence (no click).
function envelope(i, n, attackMs, releaseMs) {
  const attack = (attackMs / 1000) * SAMPLE_RATE;
  const release = (releaseMs / 1000) * SAMPLE_RATE;
  if (i < attack) return i / attack;
  if (i > n - release) return Math.max(0, (n - i) / release);
  return 1;
}

function clamp16(x) {
  return Math.max(-32767, Math.min(32767, Math.round(x)));
}

// --- illegal.wav ---------------------------------------------------------
// A short, flat, low-effort "nope" — two quick identical low-pitched
// buzzy blips. Deliberately featureless: per ADR-0007/the "Move
// rejection" CONTEXT.md entry, this must carry zero signal about *why* a
// move was illegal, so it's the same clip for every rejection reason —
// nothing in this generator varies by cause.
function genIllegal() {
  const blipMs = 55;
  const gapMs = 40;
  const blipN = Math.round((blipMs / 1000) * SAMPLE_RATE);
  const gapN = Math.round((gapMs / 1000) * SAMPLE_RATE);
  const totalN = blipN * 2 + gapN;
  const samples = new Array(totalN).fill(0);
  const freq = 220; // low "buzz" tone, clearly distinct from move/capture
  for (let rep = 0; rep < 2; rep++) {
    const start = rep * (blipN + gapN);
    for (let i = 0; i < blipN; i++) {
      const t = i / SAMPLE_RATE;
      // Mild square-ish tone (mix of a couple of harmonics rather than a
      // pure sine) for a flatter, more "buzzer" timbre than the wooden
      // move/capture tones.
      const raw =
        Math.sin(2 * Math.PI * freq * t) * 0.6 +
        Math.sin(2 * Math.PI * freq * 3 * t) * 0.25;
      const env = envelope(i, blipN, 3, 20);
      samples[start + i] = clamp16(raw * env * 9000);
    }
  }
  return samples;
}

// --- game-over.wav ---------------------------------------------------------
// King-captured / game-over sting: a short descending three-note motif —
// deliberately more substantial than move/capture/illegal since it marks
// the game actually ending, but still well under a second. No check
// concept exists in this game (ADR-0009 / CONTEXT.md "King capture") and a
// player is never told their king is threatened, so this only ever fires
// once the game is already over — it must not be reused as, or confused
// with, a mid-game "danger" cue.
function genGameOver() {
  const notes = [440, 349.23, 261.63]; // A4 -> F4 -> C4, a simple falling cadence
  const noteMs = 160;
  const noteN = Math.round((noteMs / 1000) * SAMPLE_RATE);
  const totalN = noteN * notes.length;
  const samples = new Array(totalN).fill(0);
  notes.forEach((freq, idx) => {
    const start = idx * noteN;
    for (let i = 0; i < noteN; i++) {
      const t = i / SAMPLE_RATE;
      const raw =
        Math.sin(2 * Math.PI * freq * t) * 0.7 +
        Math.sin(2 * Math.PI * freq * 2 * t) * 0.15;
      const env = envelope(i, noteN, 5, 60);
      samples[start + i] = clamp16(raw * env * 8500);
    }
  });
  return samples;
}

writeWav(path.join(OUT_DIR, 'illegal.wav'), genIllegal());
writeWav(path.join(OUT_DIR, 'game-over.wav'), genGameOver());
