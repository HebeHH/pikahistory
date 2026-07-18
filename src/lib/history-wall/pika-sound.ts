/**
 * A short, cute electric "pi-ka" zap synthesized with the Web Audio API — no
 * audio asset, no copyrighted sound. Plays on cross-link fun-fact shocks.
 * Browsers require a prior user gesture; the shock is triggered by a click, so
 * the context is already unlocked.
 */
let ctx: AudioContext | null = null;

export function playPikaZap(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = ctx ?? new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;

    // Electric zap: a bright sawtooth sweeping down.
    const zap = ctx.createOscillator();
    const zapGain = ctx.createGain();
    zap.type = "sawtooth";
    zap.frequency.setValueAtTime(950, now);
    zap.frequency.exponentialRampToValueAtTime(170, now + 0.12);
    zapGain.gain.setValueAtTime(0.0001, now);
    zapGain.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
    zapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    zap.connect(zapGain).connect(ctx.destination);
    zap.start(now);
    zap.stop(now + 0.15);

    // Two cheerful rising blips — "pi" then "ka".
    const chirp = (at: number, f0: number, f1: number) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f1, at + 0.08);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.14, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
      o.connect(g).connect(ctx!.destination);
      o.start(at);
      o.stop(at + 0.12);
    };
    chirp(now + 0.02, 720, 1120);
    chirp(now + 0.17, 1000, 1550);
  } catch {
    // Audio is a nicety; ignore failures.
  }
}
