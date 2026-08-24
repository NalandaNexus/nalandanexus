/**
 * Web Audio API synthesizer for interactive micro-interactions.
 * Zero external asset dependencies.
 */

let audioCtx = null;
let soundEnabled = true;

export function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
}

export function toggleSound() {
  soundEnabled = !soundEnabled;
  return soundEnabled;
}

export function isSoundEnabled() {
  return soundEnabled;
}

export function playTone(freq = 440, type = 'sine', duration = 0.08, gainVal = 0.05) {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Ignore audio permission restrictions
  }
}

export function playKeyStroke(charLength = 0) {
  if (!soundEnabled) return;
  const freq = 550 + Math.min(charLength * 12, 350);
  playTone(freq, 'sine', 0.035, 0.025);
}

export function playSuccessChime() {
  if (!soundEnabled) return;
  playTone(523.25, 'triangle', 0.2, 0.08); // C5
  setTimeout(() => playTone(659.25, 'triangle', 0.2, 0.08), 120); // E5
  setTimeout(() => playTone(783.99, 'triangle', 0.25, 0.08), 240); // G5
  setTimeout(() => playTone(1046.50, 'triangle', 0.45, 0.1), 360); // C6
}

export function playErrorBuzzer() {
  if (!soundEnabled) return;
  playTone(220, 'sawtooth', 0.15, 0.06);
  setTimeout(() => playTone(196, 'sawtooth', 0.2, 0.06), 100);
}
