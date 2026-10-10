// Web Audio API synthesized Garba sound synthesizer
// Plays a warm, crisp acoustic wooden "clack" when two Dandiya sticks clash,
// plus a soft chime for badge verification and celebration bursts.
// Zero external audio files required, instant, lightweight, respects mute/reduced-motion.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Synthesizes a crisp, wooden Dandiya stick strike ("CLACK!").
 * Combines a resonant wooden harmonic impulse (bandpass) with a fast decay transient strike.
 */
export function playDandiyaClackSound() {
  try {
    if (typeof window === "undefined") return;
    // Check if user prefers reduced motion or quiet mode
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Resonant wood body tone
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = "sine";
    // Pitch drops sharply like an struck wooden dowel (1100Hz down to 260Hz in 50ms)
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.06);

    gainNode.gain.setValueAtTime(0.35, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);

    // 2. High-frequency wooden snap transient (burst of filtered noise)
    const bufferSize = ctx.sampleRate * 0.03; // 30ms burst
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.setValueAtTime(4.0, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.04);

    // Trigger subtle tactile haptic vibration if supported on mobile
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([15, 20, 25]);
      } catch {}
    }
  } catch (e) {
    // Non-fatal, gracefully ignored in environments blocking autoplay
  }
}

/**
 * Celebratory upward musical chime for verified badge unlock & high vibe achievements.
 */
export function playCelebrationChime() {
  try {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (festive major arpeggio)

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteTime = now + idx * 0.07;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.2, noteTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.3);
    });

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([20, 40, 30]);
      } catch {}
    }
  } catch {}
}
