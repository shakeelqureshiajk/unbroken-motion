#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SFX_DIR, ensureDir, parseArgs } from './common.mjs';

const SAMPLE_RATE = 48000;

function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function writeStereoWav(filePath, left, right, sampleRate = SAMPLE_RATE) {
  const numSamples = left.length;
  const numChannels = 2;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * blockAlign;

  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    buf.writeInt16LE(Math.round(l * 32767), offset);
    buf.writeInt16LE(Math.round(r * 32767), offset + 2);
    offset += 4;
  }

  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, buf);
}

function genImpactDeep() {
  const dur = 0.48;
  const n = Math.floor(SAMPLE_RATE * dur);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const rand = mulberry32(101);
  let phase = 0;
  let lp = 0;

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 40 + 105 * Math.exp(-t * 28);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const sub = Math.sin(phase) * Math.exp(-t * 8.5);
    const click = (rand() * 2 - 1) * Math.exp(-t * 95);
    lp = lp * 0.72 + click * 0.28;
    const sample = 0.78 * sub + 0.32 * lp;
    const fadeOut = t > dur - 0.03 ? (dur - t) / 0.03 : 1;
    left[i] = sample * fadeOut;
    right[i] = sample * fadeOut;
  }
  return { left, right };
}

function genWhoosh(dur, peakFreq, seed) {
  const n = Math.floor(SAMPLE_RATE * dur);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const randL = mulberry32(seed);
  const randR = mulberry32(seed + 77);

  let b0L = 0, b1L = 0, b2L = 0;
  let b0R = 0, b1R = 0, b2R = 0;

  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const env = Math.sin(Math.PI * Math.pow(u, 0.75)) ** 1.4;
    const fc = 180 + peakFreq * Math.sin(Math.PI * u);
    const w0 = (2 * Math.PI * fc) / SAMPLE_RATE;
    const alpha = Math.sin(w0) / (2 * 1.4);

    // Simple 2-pole resonant bandpass update
    const xL = randL() * 2 - 1;
    const xR = randR() * 2 - 1;
    const a0 = 1 + alpha;
    const yL = ((alpha * xL - alpha * b2L) - (-2 * Math.cos(w0) * b1L + (1 - alpha) * b2L)) / a0;
    const yR = ((alpha * xR - alpha * b2R) - (-2 * Math.cos(w0) * b1R + (1 - alpha) * b2R)) / a0;

    b2L = b1L; b1L = Math.max(-2, Math.min(2, yL)); b0L = xL;
    b2R = b1R; b1R = Math.max(-2, Math.min(2, yR)); b0R = xR;
    void b0L; void b0R;

    left[i] = Math.max(-0.9, Math.min(0.9, yL * env * 0.72));
    right[i] = Math.max(-0.9, Math.min(0.9, yR * env * 0.72));
  }
  return { left, right };
}

function genUiClick() {
  const dur = 0.045;
  const n = Math.floor(SAMPLE_RATE * dur);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 150);
    const s =
      (0.55 * Math.sin(2 * Math.PI * 1650 * t) +
        0.35 * Math.sin(2 * Math.PI * 3100 * t)) *
      env;
    left[i] = s;
    right[i] = s;
  }
  return { left, right };
}

function genUiPop() {
  const dur = 0.095;
  const n = Math.floor(SAMPLE_RATE * dur);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const u = t / dur;
    const freq = 380 + 620 * u;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const env = Math.sin(Math.PI * Math.min(1, u * 1.15)) * Math.exp(-t * 28);
    const s = 0.72 * Math.sin(phase) * env;
    left[i] = s;
    right[i] = s;
  }
  return { left, right };
}

function genKeyTick() {
  const dur = 0.03;
  const n = Math.floor(SAMPLE_RATE * dur);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const rand = mulberry32(404);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 210);
    const s = (0.5 * Math.sin(2 * Math.PI * 980 * t) + 0.35 * (rand() * 2 - 1)) * env;
    left[i] = s;
    right[i] = s;
  }
  return { left, right };
}

function genRiserShort() {
  const dur = 0.6;
  const n = Math.floor(SAMPLE_RATE * dur);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const u = t / dur;
    const f1 = 220 * Math.pow(2, u * 1.5);
    const f2 = f1 * 1.503;
    p1 += (2 * Math.PI * f1) / SAMPLE_RATE;
    p2 += (2 * Math.PI * f2) / SAMPLE_RATE;
    const env = Math.pow(u, 1.8) * (u > 0.92 ? (1 - u) / 0.08 : 1);
    left[i] = 0.45 * (Math.sin(p1) + 0.6 * Math.sin(p2)) * env;
    right[i] = 0.45 * (Math.sin(p1 + 0.3) + 0.6 * Math.sin(p2 - 0.2)) * env;
  }
  return { left, right };
}

function genAmbientBed(durationSec = 20) {
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  // Warm Csus2 ambient harmonic drone with gentle pulsing shimmer
  const freqs = [130.81, 196.0, 261.63, 293.66];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const fadeIn = Math.min(1, t / 0.6);
    const fadeOut = Math.min(1, (durationSec - t) / 0.8);
    const pulse = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.5 * t);
    let sumL = 0;
    let sumR = 0;
    for (let k = 0; k < freqs.length; k++) {
      const f = freqs[k];
      const w = k === 0 ? 0.45 : 0.22;
      sumL += w * Math.sin(2 * Math.PI * (f - k * 0.12) * t);
      sumR += w * Math.sin(2 * Math.PI * (f + k * 0.14) * t + 0.4);
    }
    const g = 0.28 * fadeIn * fadeOut * pulse;
    left[i] = sumL * g;
    right[i] = sumR * g;
  }
  return { left, right };
}

export function ensureSfxBank(outDir = SFX_DIR) {
  ensureDir(outDir);
  const specs = [
    ['impact-deep.wav', () => genImpactDeep()],
    ['whoosh-fast.wav', () => genWhoosh(0.32, 2100, 202)],
    ['whoosh-soft.wav', () => genWhoosh(0.52, 850, 303)],
    ['ui-click.wav', () => genUiClick()],
    ['ui-pop.wav', () => genUiPop()],
    ['key-tick.wav', () => genKeyTick()],
    ['riser-short.wav', () => genRiserShort()],
    ['ambient-bed.wav', () => genAmbientBed(24)],
  ];

  const created = [];
  for (const [name, fn] of specs) {
    const target = path.join(outDir, name);
    if (!fs.existsSync(target)) {
      const { left, right } = fn();
      writeStereoWav(target, left, right);
      created.push(name);
    }
  }
  return { outDir, created };
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCli) {
  const { flags } = parseArgs(process.argv.slice(2));
  const outDir = flags.out ? path.resolve(String(flags.out)) : SFX_DIR;
  if (flags.force && fs.existsSync(outDir)) {
    for (const f of fs.readdirSync(outDir)) {
      if (f.endsWith('.wav')) fs.unlinkSync(path.join(outDir, f));
    }
  }
  const res = ensureSfxBank(outDir);
  console.log(`Procedural CC0 SFX bank ready at ${res.outDir} (generated ${res.created.length} file(s))`);
}

