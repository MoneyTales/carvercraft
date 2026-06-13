// Procedural sound effects — zero audio assets. Own AudioContext (the engine's
// AudioManager is asset-oriented; we synthesize).

import { BLOCKS } from "../voxel/blocks";

let ctx: AudioContext | null = null;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/** sound family per block: 0 soft / 1 stone / 2 wood / 3 sand / 4 glass */
const FAMILY_FREQ = [420, 220, 320, 520, 1400];

function thud(family: number, gainScale: number, dur: number): void {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const filt = c.createBiquadFilter();
  filt.type = family === 4 ? "highpass" : "lowpass";
  filt.frequency.setValueAtTime(FAMILY_FREQ[family] ?? 420, t);
  filt.frequency.exponentialRampToValueAtTime(Math.max(80, (FAMILY_FREQ[family] ?? 420) * 0.4), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gainScale, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filt).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + dur);
}

function blip(freq: number, gainScale: number, dur = 0.09): void {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "square";
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.7, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gainScale * 0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur);
}

const att = (dist: number) => Math.max(0, 1 - dist / 26);

export const sfx = {
  /** unlock audio on a user gesture */
  unlock(): void {
    ensure();
  },
  breakBlock(block: number, dist = 0): void {
    const a = att(dist);
    if (a <= 0) return;
    thud(BLOCKS[block]?.sound ?? 0, 0.5 * a, 0.16);
  },
  placeBlock(block: number, dist = 0): void {
    const a = att(dist);
    if (a <= 0) return;
    const fam = BLOCKS[block]?.sound ?? 0;
    blip(fam === 1 ? 180 : fam === 4 ? 900 : 300, 0.5 * a, 0.07);
    thud(fam, 0.18 * a, 0.08);
  },
  click(): void {
    blip(660, 0.25, 0.05);
  },
  jump(): void {
    blip(240, 0.12, 0.08);
  },
  land(): void {
    thud(0, 0.35, 0.12);
  },
};
