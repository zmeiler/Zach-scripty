/**
 * Tiny synthesised sound effects.
 *
 * No audio files: a handful of oscillator envelopes cover every cue, which
 * keeps the client asset-free and lets sounds load instantly.
 */

import { bus, state } from './state.js';

let ctx = null;

const CUES = {
  hit: { type: 'square', from: 220, to: 90, duration: 0.12, gain: 0.05 },
  hurt: { type: 'sawtooth', from: 180, to: 70, duration: 0.18, gain: 0.06 },
  levelup: { type: 'triangle', from: 440, to: 880, duration: 0.45, gain: 0.07 },
  quest: { type: 'triangle', from: 523, to: 784, duration: 0.6, gain: 0.07 },
  pickup: { type: 'sine', from: 660, to: 990, duration: 0.09, gain: 0.05 },
  chop: { type: 'square', from: 140, to: 110, duration: 0.09, gain: 0.04 },
  error: { type: 'sine', from: 200, to: 140, duration: 0.15, gain: 0.04 }
};

function ensureContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

export function play(cueName) {
  if (!state.settings.sound) return;
  const cue = CUES[cueName];
  if (!cue) return;
  const audio = ensureContext();
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume();

  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = cue.type;
  osc.frequency.setValueAtTime(cue.from, audio.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, cue.to), audio.currentTime + cue.duration);
  gain.gain.setValueAtTime(cue.gain, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + cue.duration);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + cue.duration + 0.02);
}

export function initAudio() {
  // The browser only allows audio after a gesture, so warm up on first input.
  const warm = () => {
    ensureContext();
    window.removeEventListener('pointerdown', warm);
    window.removeEventListener('keydown', warm);
  };
  window.addEventListener('pointerdown', warm);
  window.addEventListener('keydown', warm);

  bus.on('effect', (effect) => {
    if (effect.kind === 'levelup') play('levelup');
    else if (effect.kind === 'quest') play('quest');
    else if (effect.kind === 'knockout') play('hurt');
  });

  bus.on('state', (msg) => {
    for (const splat of msg.splats || []) {
      if (splat.damage <= 0) continue;
      play(splat.id === state.playerId ? 'hurt' : 'hit');
      break;
    }
  });
}
