import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDir } from './common.mjs';

export const SAMPLE_RATE = 48000;

/**
 * Reads a 16-bit or 32-bit PCM WAV file into stereo Float32Arrays [-1, 1].
 */
export function parseStereoWavBuffer(buf, label = 'buffer') {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') {
    throw new Error(`Not a RIFF WAV stream: ${label}`);
  }
  let offset = 12;
  let channels = 2;
  let sampleRate = SAMPLE_RATE;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(offset + 10);
      sampleRate = buf.readUInt32LE(offset + 12);
      bitsPerSample = buf.readUInt16LE(offset + 22);
    } else if (id === 'data') {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }

  if (dataOffset < 0) {
    throw new Error(`WAV stream missing data chunk: ${label}`);
  }

  const bytesPerSample = Math.max(2, bitsPerSample / 8);
  const availBytes = Math.max(0, buf.length - dataOffset);
  // Pipe-encoded WAV outputs often leave data chunk size at 0xffffffff or 0
  const effectiveBytes =
    dataSize === 0xffffffff || dataSize === 0 || dataSize > availBytes
      ? availBytes
      : dataSize;
  const frameCount = Math.floor(effectiveBytes / (channels * bytesPerSample));
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);

  let pos = dataOffset;
  for (let i = 0; i < frameCount; i++) {
    let l = 0;
    let r = 0;
    if (bitsPerSample === 16) {
      l = buf.readInt16LE(pos) / 32768;
      r = channels > 1 ? buf.readInt16LE(pos + 2) / 32768 : l;
    } else if (bitsPerSample === 32) {
      l = buf.readFloatLE(pos);
      r = channels > 1 ? buf.readFloatLE(pos + 4) : l;
    }
    left[i] = l;
    right[i] = r;
    pos += channels * bytesPerSample;
  }

  return { left, right, sampleRate };
}

export function readStereoWav(wavPath) {
  const buf = fs.readFileSync(wavPath);
  return parseStereoWavBuffer(buf, wavPath);
}

/**
 * Decodes any audio or video file to 48kHz stereo Float32Array via ffmpeg.
 */
export function decodeAudioViaFfmpeg(ffmpeg, inputPath) {
  if (inputPath.toLowerCase().endsWith('.wav')) {
    try {
      const w = readStereoWav(inputPath);
      if (w.sampleRate === SAMPLE_RATE) return w;
    } catch {
      // Fallback to ffmpeg resample
    }
  }
  const res = spawnSync(
    ffmpeg,
    [
      '-v',
      'error',
      '-i',
      inputPath,
      '-vn',
      '-ac',
      '2',
      '-ar',
      String(SAMPLE_RATE),
      '-c:a',
      'pcm_s16le',
      '-f',
      'wav',
      'pipe:1',
    ],
    { windowsHide: true, maxBuffer: 64 * 1024 * 1024 }
  );
  if (res.status !== 0 || !res.stdout) {
    const errMsg = res.stderr ? res.stderr.toString().trim() : '';
    throw new Error(`ffmpeg failed decoding audio from ${inputPath}${errMsg ? `: ${errMsg}` : ''}`);
  }
  return parseStereoWavBuffer(res.stdout, inputPath);
}

export function writeStereoWav(filePath, left, right, sampleRate = SAMPLE_RATE) {
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
  buf.writeUInt16LE(1, 20);
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

/**
 * Subtle stereo Schroeder room reverb so all SFX share one cohesive acoustic space.
 */
export function applyStereoRoomReverb(left, right, wetMix = 0.16) {
  const n = left.length;
  const combDelaysL = [1116, 1188, 1277, 1356];
  const combDelaysR = [1139, 1211, 1300, 1379];
  const combFeedback = 0.72;
  const damp = 0.28;

  const processChannel = (input, delays) => {
    const out = new Float32Array(n);
    const combBufs = delays.map((d) => new Float32Array(d));
    const combIdx = new Int32Array(delays.length);
    const combStore = new Float32Array(delays.length);

    for (let i = 0; i < n; i++) {
      const x = input[i] * 0.25;
      let acc = 0;
      for (let c = 0; c < delays.length; c++) {
        const buf = combBufs[c];
        const idx = combIdx[c];
        const y = buf[idx];
        combStore[c] = y * (1 - damp) + combStore[c] * damp;
        buf[idx] = x + combStore[c] * combFeedback;
        combIdx[c] = (idx + 1) % buf.length;
        acc += y;
      }
      out[i] = input[i] * (1 - wetMix) + acc * wetMix;
    }
    return out;
  };

  return {
    left: processChannel(left, combDelaysL),
    right: processChannel(right, combDelaysR),
  };
}

/**
 * True side-chain compressor: ducks background bed smoothly whenever SFX bus triggers.
 */
export function applySidechainDucking(bedL, bedR, sfxL, sfxR) {
  const n = bedL.length;
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);

  const attackCoeff = Math.exp(-1 / (0.008 * SAMPLE_RATE));
  const releaseCoeff = Math.exp(-1 / (0.22 * SAMPLE_RATE));
  const threshold = 0.035;
  let env = 0;

  for (let i = 0; i < n; i++) {
    const peak = Math.max(Math.abs(sfxL[i]), Math.abs(sfxR[i]));
    env = peak > env
      ? attackCoeff * env + (1 - attackCoeff) * peak
      : releaseCoeff * env + (1 - releaseCoeff) * peak;

    const excess = Math.max(0, env - threshold);
    const duckGain = Math.max(0.22, 1 / (1 + excess * 14));
    outL[i] = bedL[i] * duckGain;
    outR[i] = bedR[i] * duckGain;
  }

  return { left: outL, right: outR };
}

/**
 * ITU-R BS.1770 K-weighted integrated loudness (LUFS) and peak dBTP estimator.
 */
export function measureLoudnessAndPeak(left, right, sampleRate = SAMPLE_RATE) {
  const n = left.length;
  // BS.1770 Stage 1 pre-filter (high-shelf) & Stage 2 RLB high-pass @ 48kHz
  const b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285];
  const a1 = [1.0, -1.69065929318241, 0.73248077421585];
  const b2 = [1.0, -2.0, 1.0];
  const a2 = [1.0, -1.99004745483398, 0.99007225036621];

  const kWeight = (src) => {
    const out = new Float32Array(n);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    let u1 = 0, u2 = 0, z1 = 0, z2 = 0;
    for (let i = 0; i < n; i++) {
      const x = src[i];
      const y = b1[0] * x + b1[1] * x1 + b1[2] * x2 - a1[1] * y1 - a1[2] * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;

      const z = b2[0] * y + b2[1] * u1 + b2[2] * u2 - a2[1] * z1 - a2[2] * z2;
      u2 = u1; u1 = y; z2 = z1; z1 = z;
      out[i] = z;
    }
    return out;
  };

  const kwL = kWeight(left);
  const kwR = kWeight(right);

  // 400ms gated blocks with 100ms hop
  const blockLen = Math.round(0.4 * sampleRate);
  const hopLen = Math.round(0.1 * sampleRate);
  const blockPowers = [];

  for (let start = 0; start + blockLen <= n; start += hopLen) {
    let sumSq = 0;
    for (let i = start; i < start + blockLen; i++) {
      sumSq += kwL[i] * kwL[i] + kwR[i] * kwR[i];
    }
    const meanSq = sumSq / blockLen;
    const lufs = -0.691 + 10 * Math.log10(Math.max(1e-12, meanSq));
    if (lufs > -70) {
      blockPowers.push({ meanSq, lufs });
    }
  }

  let integratedLufs = -70;
  if (blockPowers.length > 0) {
    const avgAbs = blockPowers.reduce((s, b) => s + b.meanSq, 0) / blockPowers.length;
    const relGate = -0.691 + 10 * Math.log10(Math.max(1e-12, avgAbs)) - 10;
    const gated = blockPowers.filter((b) => b.lufs >= relGate);
    const active = gated.length > 0 ? gated : blockPowers;
    const finalPow = active.reduce((s, b) => s + b.meanSq, 0) / active.length;
    integratedLufs = -0.691 + 10 * Math.log10(Math.max(1e-12, finalPow));
  }

  // Sample peak + 2-point cubic midpoint true-peak estimate
  let maxPeak = 0;
  for (let i = 1; i < n - 2; i++) {
    maxPeak = Math.max(maxPeak, Math.abs(left[i]), Math.abs(right[i]));
    const midL = Math.abs(0.5625 * (left[i] + left[i + 1]) - 0.0625 * (left[i - 1] + left[i + 2]));
    const midR = Math.abs(0.5625 * (right[i] + right[i + 1]) - 0.0625 * (right[i - 1] + right[i + 2]));
    maxPeak = Math.max(maxPeak, midL, midR);
  }
  const truePeakDbtp = 20 * Math.log10(Math.max(1e-9, maxPeak));

  return { integratedLufs, truePeakDbtp };
}

/**
 * Normalizes mix to targetLufs (-14 LUFS) with look-ahead soft-knee brickwall ceiling (-1.1 dBTP).
 */
export function masterNormalizeAndLimit(left, right, targetLufs = -14.0, ceilingDb = -1.1) {
  const n = left.length;
  const { integratedLufs } = measureLoudnessAndPeak(left, right);
  const gainDb = integratedLufs > -60 ? Math.max(-18, Math.min(24, targetLufs - integratedLufs)) : 0;
  const gainLin = Math.pow(10, gainDb / 20);
  const ceilingLin = Math.pow(10, ceilingDb / 20);

  const outL = new Float32Array(n);
  const outR = new Float32Array(n);

  // Compute smooth look-ahead gain reduction envelope for peaks above ceiling
  const lookAhead = Math.round(0.004 * SAMPLE_RATE); // 4ms lookahead
  const peakEnv = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(left[i] * gainLin), Math.abs(right[i] * gainLin));
    const idx = Math.max(0, i - lookAhead);
    if (p > peakEnv[idx]) peakEnv[idx] = p;
  }

  // Smooth release over 45ms
  const rel = Math.exp(-1 / (0.045 * SAMPLE_RATE));
  let holdPeak = 0;
  for (let i = 0; i < n; i++) {
    holdPeak = Math.max(peakEnv[i], holdPeak * rel);
    const limitGain = holdPeak > ceilingLin ? ceilingLin / holdPeak : 1;
    outL[i] = Math.max(-ceilingLin, Math.min(ceilingLin, left[i] * gainLin * limitGain));
    outR[i] = Math.max(-ceilingLin, Math.min(ceilingLin, right[i] * gainLin * limitGain));
  }

  return { left: outL, right: outR, stats: measureLoudnessAndPeak(outL, outR) };
}
