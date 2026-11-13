#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureDir,
  parseArgs,
  readJson,
  resolveFfmpegBinaries,
  resolveFilmDir,
  resolveSfxDir,
  runBin,
} from './common.mjs';
import {
  SAMPLE_RATE,
  applySidechainDucking,
  applyStereoRoomReverb,
  decodeAudioViaFfmpeg,
  masterNormalizeAndLimit,
  readStereoWav,
  writeStereoWav,
} from './dsp.mjs';
import { ensureSfxBank } from './synth-sfx.mjs';

const EVENT_TO_WAV = {
  impact: 'impact-deep.wav',
  whoosh: 'whoosh-fast.wav',
  'whoosh-soft': 'whoosh-soft.wav',
  click: 'ui-click.wav',
  pop: 'ui-pop.wav',
  tick: 'key-tick.wav',
  riser: 'riser-short.wav',
};

function collectAudioEvents(beats, manifest) {
  const events = [];

  for (const beat of beats.beats) {
    for (const ev of beat.audioEvents || []) {
      events.push({
        atSec: ev.atSec,
        type: ev.type,
        intensity: ev.intensity ?? 0.7,
        source: 'beats.json',
      });
    }
  }

  if (beats.audio?.autoSfx !== false && manifest?.frames?.length) {
    let lastAutoWhoosh = -1;
    let lastAutoImpact = -1;
    for (let i = 1; i < manifest.frames.length; i++) {
      const prev = manifest.frames[i - 1];
      const curr = manifest.frames[i];
      if (prev.camera.speedNorm <= 32 && curr.camera.speedNorm > 32) {
        if (curr.timeSec - lastAutoWhoosh > 0.45) {
          const alreadyNear = events.some(
            (e) =>
              (e.type === 'whoosh' || e.type === 'whoosh-soft') &&
              Math.abs(e.atSec - curr.timeSec) < 0.25
          );
          if (!alreadyNear) {
            events.push({
              atSec: Math.max(0, curr.timeSec - 0.06),
              type: 'whoosh',
              intensity: 0.75,
              source: 'auto-manifest-velocity',
            });
            lastAutoWhoosh = curr.timeSec;
          }
        }
      }
      if (prev.camera.trauma <= 0.25 && curr.camera.trauma > 0.25) {
        if (curr.timeSec - lastAutoImpact > 0.45) {
          const alreadyNear = events.some(
            (e) => e.type === 'impact' && Math.abs(e.atSec - curr.timeSec) < 0.2
          );
          if (!alreadyNear) {
            events.push({
              atSec: curr.timeSec,
              type: 'impact',
              intensity: 0.85,
              source: 'auto-manifest-trauma',
            });
            lastAutoImpact = curr.timeSec;
          }
        }
      }
    }
  }

  events.sort((a, b) => a.atSec - b.atSec);
  return events;
}

export async function mixSoundForFilm(filmArg, options = {}) {
  const filmDir = resolveFilmDir(filmArg);
  const beats = readJson(path.join(filmDir, 'beats.json'));
  const manifestPath = path.join(filmDir, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;

  const { ffmpeg } = resolveFfmpegBinaries(filmDir);
  if (!ffmpeg) {
    throw new Error('ffmpeg binary not found; cannot mux film audio.');
  }

  const sfxDir = resolveSfxDir(filmDir);
  ensureSfxBank(sfxDir);

  const lastBeat = beats.beats[beats.beats.length - 1];
  const totalDurSec = lastBeat ? lastBeat.start + lastBeat.duration : 6;
  const totalSamples = Math.max(1, Math.round(totalDurSec * SAMPLE_RATE));
  const events = collectAudioEvents(beats, manifest);

  const audioDir = path.join(filmDir, 'audio');
  ensureDir(audioDir);

  // 1. Prepare Music / Ambient Bed
  const bedL = new Float32Array(totalSamples);
  const bedR = new Float32Array(totalSamples);
  const customMusic =
    beats.audio?.musicPath && fs.existsSync(path.resolve(filmDir, beats.audio.musicPath))
      ? path.resolve(filmDir, beats.audio.musicPath)
      : null;
  const bedSource = customMusic || (beats.audio?.useAmbientBed !== false ? path.join(sfxDir, 'ambient-bed.wav') : null);

  if (bedSource && fs.existsSync(bedSource)) {
    const decodedBed = decodeAudioViaFfmpeg(ffmpeg, bedSource);
    const bedGain = customMusic ? 0.35 : 0.45;
    const fadeInSamples = Math.round(0.25 * SAMPLE_RATE);
    const fadeOutSamples = Math.round(0.45 * SAMPLE_RATE);

    for (let i = 0; i < totalSamples; i++) {
      const srcIdx = i % decodedBed.left.length;
      let env = 1;
      if (i < fadeInSamples) env = i / Math.max(1, fadeInSamples);
      else if (i > totalSamples - fadeOutSamples) env = Math.max(0, (totalSamples - i) / Math.max(1, fadeOutSamples));
      bedL[i] = decodedBed.left[srcIdx] * bedGain * env;
      bedR[i] = decodedBed.right[srcIdx] * bedGain * env;
    }
  }

  // 2. Place SFX onto SFX Bus
  const sfxL = new Float32Array(totalSamples);
  const sfxR = new Float32Array(totalSamples);
  const wavCache = new Map();

  for (const ev of events) {
    const wavName = EVENT_TO_WAV[ev.type] || 'ui-click.wav';
    if (!wavCache.has(wavName)) {
      wavCache.set(wavName, readStereoWav(path.join(sfxDir, wavName)));
    }
    const sample = wavCache.get(wavName);
    const startIdx = Math.max(0, Math.round(ev.atSec * SAMPLE_RATE));
    const gain = Math.max(0.1, Math.min(1.8, (ev.intensity ?? 0.7) * 1.1));
    const endIdx = Math.min(totalSamples, startIdx + sample.left.length);

    for (let i = startIdx; i < endIdx; i++) {
      const k = i - startIdx;
      sfxL[i] += sample.left[k] * gain;
      sfxR[i] += sample.right[k] * gain;
    }
  }

  // 3. Shared Room Reverb on SFX Bus + Sidechain Ducking on Bed
  const wetSfx = events.length > 0 ? applyStereoRoomReverb(sfxL, sfxR, 0.16) : { left: sfxL, right: sfxR };
  const duckedBed = events.length > 0
    ? applySidechainDucking(bedL, bedR, wetSfx.left, wetSfx.right)
    : { left: bedL, right: bedR };

  // 4. Sum & Master Normalize (-14 LUFS, -1.1 dBTP brickwall ceiling)
  const mixL = new Float32Array(totalSamples);
  const mixR = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    mixL[i] = duckedBed.left[i] + wetSfx.left[i];
    mixR[i] = duckedBed.right[i] + wetSfx.right[i];
  }

  // Keep -1.85 dB PCM ceiling + 256k AAC so lossy MP4 encoding stays strictly <= -1.0 dBTP
  const mastered = masterNormalizeAndLimit(mixL, mixR, -14.0, -1.85);
  const masterWavPath = path.join(audioDir, 'master.wav');
  writeStereoWav(masterWavPath, mastered.left, mastered.right, SAMPLE_RATE);

  // 5. Mux audio cleanly into target MP4 (video stream copy + AAC 256k)
  const videoPath = options.videoPath
    ? path.resolve(options.videoPath)
    : path.join(filmDir, 'out', 'draft.mp4');

  let muxedVideoPath = null;
  if (fs.existsSync(videoPath)) {
    const outPath = options.outPath ? path.resolve(options.outPath) : videoPath;
    const tempMuxed = outPath + '.mux.mp4';
    runBin(ffmpeg, [
      '-y',
      '-i',
      videoPath,
      '-i',
      masterWavPath,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '256k',
      '-shortest',
      tempMuxed,
    ]);
    fs.renameSync(tempMuxed, outPath);
    muxedVideoPath = outPath;
  }

  // 6. Write CREDITS.md
  const creditsLines = [
    `# Audio & Asset Credits — ${beats.film}`,
    '',
    `- **Brand Tokens:** \`${beats.brand}\` (original skill brand manifest)`,
    `- **SFX Primitives:** Procedural 48kHz CC0 WAV synthesis via \`scripts/synth-sfx.mjs\` (${events.length} triggered event(s))`,
    customMusic
      ? `- **Music Bed:** Custom stem \`${beats.audio.musicPath}\``
      : `- **Music Bed:** Procedural CC0 harmonic underscore (\`ambient-bed.wav\`)`,
    `- **Mixing & Loudness:** Shared stereo Schroeder room reverb + side-chain ducking + BS.1770 normalization (${mastered.stats.integratedLufs.toFixed(1)} LUFS, ${mastered.stats.truePeakDbtp.toFixed(2)} dBTP)`,
    '',
  ];
  fs.writeFileSync(path.join(filmDir, 'CREDITS.md'), creditsLines.join('\n'), 'utf8');

  return {
    masterWavPath,
    muxedVideoPath,
    eventCount: events.length,
    stats: mastered.stats,
    events,
  };
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCli) {
  const { flags } = parseArgs(process.argv.slice(2));
  if (!flags.film) {
    console.error('Usage: node scripts/sound.mjs --film <name-or-path> [--video <mp4>] [--out <mp4>]');
    process.exit(1);
  }
  const res = await mixSoundForFilm(String(flags.film), {
    videoPath: flags.video ? String(flags.video) : undefined,
    outPath: flags.out ? String(flags.out) : undefined,
  });
  console.log(
    `Audio mixed (${res.eventCount} SFX events, ${res.stats.integratedLufs.toFixed(1)} LUFS, ${res.stats.truePeakDbtp.toFixed(2)} dBTP) -> ${res.masterWavPath}` +
      (res.muxedVideoPath ? ` & muxed into ${res.muxedVideoPath}` : '')
  );
}
