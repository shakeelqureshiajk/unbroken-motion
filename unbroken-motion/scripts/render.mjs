#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureDir,
  parseArgs,
  readJson,
  resolutionForAspect,
  resolveFfmpegBinaries,
  resolveFilmDir,
  syncFilmBrandJson,
} from './common.mjs';
import { generateManifestForFilm } from './manifest.mjs';
import { mixSoundForFilm } from './sound.mjs';
import { generateStillsForFilm } from './stills.mjs';
import { runVerification } from './verify.mjs';

async function blendSubframePassesRaw(ffmpeg, passPaths, weights, width, height, _fps, outPath) {
  const frameBytes = width * height * 3;
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const WEIGHT_SCALE = 4096;
  const intWeights = weights.map((w) => Math.max(0, Math.round((w / weightSum) * WEIGHT_SCALE)));
  // Adjust middle sample so integer weights sum to exactly 4096 (no bias or overflow)
  const intSum = intWeights.reduce((a, b) => a + b, 0);
  intWeights[Math.floor(intWeights.length / 2)] += WEIGHT_SCALE - intSum;

  // Remotion bundled ffmpeg lacks the rawvideo input demuxer, so wrap bgr24 frames in a minimal streaming AVI container
  const hdrRes = spawnSync(
    ffmpeg,
    ['-v', 'error', '-i', passPaths[0], '-frames:v', '1', '-c:v', 'rawvideo', '-pix_fmt', 'bgr24', '-f', 'avi', 'pipe:1'],
    { maxBuffer: frameBytes + 262144, windowsHide: true }
  );
  if (hdrRes.status !== 0 || !hdrRes.stdout) {
    throw new Error(`ffmpeg failed generating AVI header: ${hdrRes.stderr?.toString() || ''}`);
  }
  const moviIdx = hdrRes.stdout.indexOf('movi');
  if (moviIdx < 0) {
    throw new Error('Could not locate movi header in ffmpeg AVI stream.');
  }
  const aviHeader = hdrRes.stdout.subarray(0, moviIdx + 4);
  const chunkHdr = Buffer.allocUnsafe(8);
  chunkHdr.write('00dc', 0, 'ascii');
  chunkHdr.writeUInt32LE(frameBytes, 4);

  const decoderErrs = passPaths.map(() => '');
  const decoders = passPaths.map((p, idx) => {
    const proc = spawn(
      ffmpeg,
      ['-v', 'error', '-i', p, '-c:v', 'rawvideo', '-pix_fmt', 'bgr24', '-f', 'image2pipe', 'pipe:1'],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
    );
    proc.stderr.on('data', (d) => { decoderErrs[idx] += d.toString(); });
    return proc;
  });

  const decoderPromises = decoders.map(
    (proc, idx) =>
      new Promise((resolve, reject) => {
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg decoder #${idx} failed (${code}): ${decoderErrs[idx]}`));
        });
      })
  );

  const encoder = spawn(
    ffmpeg,
    [
      '-y',
      '-v',
      'error',
      '-f',
      'avi',
      '-i',
      'pipe:0',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '15',
      '-pix_fmt',
      'yuv420p',
      outPath,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true }
  );

  let encStderr = '';
  encoder.stderr.on('data', (d) => { encStderr += d.toString(); });
  const encoderDone = new Promise((resolve, reject) => {
    encoder.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg encoder failed (${code}): ${encStderr}`));
    });
  });

  encoder.stdin.write(aviHeader);

  const createFrameReader = (stream) => {
    let buffered = [];
    let bufferedLen = 0;
    let ended = false;
    const waiters = [];

    const tryFlush = () => {
      while (waiters.length > 0) {
        if (bufferedLen >= frameBytes) {
          const out = Buffer.allocUnsafe(frameBytes);
          let copied = 0;
          while (copied < frameBytes && buffered.length > 0) {
            const head = buffered[0];
            const need = frameBytes - copied;
            if (head.length <= need) {
              head.copy(out, copied);
              copied += head.length;
              buffered.shift();
            } else {
              head.copy(out, copied, 0, need);
              buffered[0] = head.subarray(need);
              copied += need;
            }
          }
          bufferedLen -= frameBytes;
          if (bufferedLen < frameBytes * 2 && stream.isPaused()) {
            stream.resume();
          }
          waiters.shift()(out);
        } else if (ended) {
          waiters.shift()(null);
        } else {
          break;
        }
      }
    };

    stream.on('data', (chunk) => {
      buffered.push(chunk);
      bufferedLen += chunk.length;
      if (bufferedLen >= frameBytes * 2 && !stream.isPaused()) {
        stream.pause();
      }
      tryFlush();
    });
    stream.on('end', () => {
      ended = true;
      tryFlush();
    });

    return () =>
      new Promise((resolve) => {
        waiters.push(resolve);
        tryFlush();
      });
  };

  const readers = decoders.map((d) => createFrameReader(d.stdout));
  const outBufs = [Buffer.allocUnsafe(frameBytes), Buffer.allocUnsafe(frameBytes)];
  let frameCount = 0;

  while (true) {
    const frames = await Promise.all(readers.map((r) => r()));
    if (frames.some((f) => f === null)) break;

    const blended = outBufs[frameCount & 1];
    frameCount++;

    if (frames.length === 4) {
      const f0 = frames[0];
      const f1 = frames[1];
      const f2 = frames[2];
      const f3 = frames[3];
      const w0 = intWeights[0];
      const w1 = intWeights[1];
      const w2 = intWeights[2];
      const w3 = intWeights[3];
      for (let i = 0; i < frameBytes; i++) {
        blended[i] = (f0[i] * w0 + f1[i] * w1 + f2[i] * w2 + f3[i] * w3 + 2048) >> 12;
      }
    } else {
      for (let i = 0; i < frameBytes; i++) {
        let acc = 2048;
        for (let k = 0; k < frames.length; k++) {
          acc += frames[k][i] * intWeights[k];
        }
        blended[i] = acc >> 12;
      }
    }

    if (!encoder.stdin.write(chunkHdr)) {
      await new Promise((r) => encoder.stdin.once('drain', r));
    }
    if (!encoder.stdin.write(blended)) {
      await new Promise((r) => encoder.stdin.once('drain', r));
    }
  }

  encoder.stdin.end();
  await Promise.all([encoderDone, ...decoderPromises]);
  if (frameCount === 0) {
    throw new Error('blendSubframePassesRaw blended 0 frames from sub-sample passes.');
  }
}

async function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  if (!flags.film || (!flags.draft && !flags.final)) {
    console.error(
      'Usage: node scripts/render.mjs --film <name-or-path> (--draft | --final) [--blur-samples 4] [--out <path>] [--force] [--no-sound] [--no-stills] [--gallery]'
    );
    process.exit(1);
  }

  const isFinal = Boolean(flags.final);
  const filmDir = resolveFilmDir(String(flags.film));
  const beats = readJson(path.join(filmDir, 'beats.json'));
  const { tokens: brand } = syncFilmBrandJson(filmDir, beats.brand);

  // 1. Always generate fresh manifest before rendering
  await generateManifestForFilm(filmDir);

  // 2. If --final, refuse to proceed unless verify.mjs passes (unless --force)
  if (isFinal && !flags.force) {
    const preCheck = await runVerification(filmDir, { requireAudio: false });
    if (!preCheck.passed) {
      console.error('Refusing --final render because verify.mjs failed. Fix gates or pass --force:');
      for (const g of preCheck.gates.filter((x) => !x.passed)) {
        console.error(`  [FAIL] ${g.gate} (${g.name}): ${g.summary}`);
      }
      process.exit(1);
    }
  }

  const outDir = path.join(filmDir, 'out');
  ensureDir(outDir);
  const defaultOut = isFinal
    ? path.join(outDir, 'final-4k60.mp4')
    : path.join(outDir, 'draft.mp4');
  const outPath = flags.out ? path.resolve(String(flags.out)) : defaultOut;

  const req = createRequire(path.join(filmDir, 'package.json'));
  const { bundle } = req('@remotion/bundler');
  const { openBrowser, selectComposition, renderMedia } = req('@remotion/renderer');

  console.log(`Bundling ${beats.film} (${isFinal ? 'FINAL 4K60' : 'DRAFT'})...`);
  const bundleLocation = await bundle({
    entryPoint: path.join(filmDir, 'src', 'index.ts'),
    onProgress: () => {},
  });

  const browser = await openBrowser('chrome');

  try {
    // Optional Gallery render mode
    if (flags.gallery) {
      const galleryOut = path.join(outDir, 'gallery.mp4');
      const comp = await selectComposition({
        serveUrl: bundleLocation,
        id: 'Gallery',
        inputProps: { brand },
        puppeteerInstance: browser,
      });
      await renderMedia({
        composition: comp,
        serveUrl: bundleLocation,
        codec: 'h264',
        outputLocation: galleryOut,
        inputProps: { brand },
        puppeteerInstance: browser,
      });
      console.log(`Rendered Gallery -> ${galleryOut}`);
      return;
    }

    if (!isFinal) {
      // DRAFT RENDER (1080p30 or aspect equivalent)
      const comp = await selectComposition({
        serveUrl: bundleLocation,
        id: 'Film',
        inputProps: {
          shutterOffset: 0,
          enableDraftBlur: true,
        },
        puppeteerInstance: browser,
      });

      await renderMedia({
        composition: comp,
        serveUrl: bundleLocation,
        codec: 'h264',
        outputLocation: outPath,
        inputProps: {
          shutterOffset: 0,
          enableDraftBlur: true,
        },
        puppeteerInstance: browser,
      });
      console.log(`Rendered draft video -> ${outPath}`);

      if (!flags['no-stills']) {
        const stills = await generateStillsForFilm(filmDir, {
          videoPath: outPath,
          bundleLocation,
          browser,
        });
        console.log(`Generated stills -> ${stills.boundaryOut}, ${stills.overviewOut}`);
      }
    } else {
      // FINAL 4K60 SUPERSAMPLED RENDER
      const { ffmpeg } = resolveFfmpegBinaries(filmDir);
      if (!ffmpeg) {
        throw new Error('ffmpeg binary not found; cannot blend final temporal sub-samples.');
      }

      const samples = Math.max(1, parseInt(String(flags['blur-samples'] ?? '4'), 10));
      const finalRes = resolutionForAspect(beats.aspectRatio, true);
      const finalBeats = {
        ...beats,
        fps: 60,
        resolution: finalRes,
      };

      const tmpPassDir = path.join(outDir, '.final-passes');
      ensureDir(tmpPassDir);

      if (samples === 1) {
        const inputProps = {
          shutterOffset: 0,
          enableDraftBlur: true,
          beatsOverride: finalBeats,
          brandOverride: brand,
        };
        const comp = await selectComposition({
          serveUrl: bundleLocation,
          id: 'Film',
          inputProps,
          puppeteerInstance: browser,
        });
        await renderMedia({
          composition: comp,
          serveUrl: bundleLocation,
          codec: 'h264',
          crf: 15,
          outputLocation: outPath,
          inputProps,
          puppeteerInstance: browser,
        });
      } else {
        // Render N sub-frame passes across 180-degree shutter interval [-0.25, +0.25] frames
        const passPaths = [];
        const reuseExisting = Boolean(flags['reuse-passes']);
        for (let k = 0; k < samples; k++) {
          const shutterOffset = -0.25 + ((k + 0.5) / samples) * 0.5;
          const passOut = path.join(tmpPassDir, `sub_${k}.mp4`);
          if (reuseExisting && fs.existsSync(passOut) && fs.statSync(passOut).size > 10000) {
            console.log(`  Reusing existing 4K60 sub-frame pass ${k + 1}/${samples}: ${passOut}`);
            passPaths.push(passOut);
            continue;
          }
          const inputProps = {
            shutterOffset,
            enableDraftBlur: false,
            beatsOverride: finalBeats,
            brandOverride: brand,
          };
          const comp = await selectComposition({
            serveUrl: bundleLocation,
            id: 'Film',
            inputProps,
            puppeteerInstance: browser,
          });
          console.log(
            `  Rendering 4K60 sub-frame pass ${k + 1}/${samples} (shutterOffset=${shutterOffset.toFixed(4)})...`
          );
          await renderMedia({
            composition: comp,
            serveUrl: bundleLocation,
            codec: 'h264',
            crf: 12,
            outputLocation: passOut,
            inputProps,
            puppeteerInstance: browser,
          });
          passPaths.push(passOut);
        }

        // Temporally average sub-frame passes frame-for-frame using raw rgb24 blending
        const weights = passPaths.map((_, idx) => {
          const mid = (passPaths.length - 1) / 2;
          return 2 - Math.abs(idx - mid) / Math.max(1, mid);
        });
        console.log(`  Averaging ${samples} sub-frame passes across 180-degree shutter...`);
        await blendSubframePassesRaw(
          ffmpeg,
          passPaths,
          weights,
          finalRes.width,
          finalRes.height,
          60,
          outPath
        );
        fs.rmSync(tmpPassDir, { recursive: true, force: true });
      }
      console.log(`Rendered 4K60 final video -> ${outPath}`);
    }
  } finally {
    await browser.close({ silent: true });
  }

  // Mix sound unless --no-sound
  if (!flags['no-sound']) {
    const soundRes = await mixSoundForFilm(filmDir, {
      videoPath: outPath,
      outPath,
    });
    console.log(`Mixed & muxed audio (${soundRes.eventCount} SFX events) -> ${outPath}`);
  }

  // Final verification pass
  const postVerify = await runVerification(filmDir, {
    requireAudio: !flags['no-sound'],
    videoPath: outPath,
  });
  for (const g of postVerify.gates) {
    const tag = g.skipped ? 'SKIP' : g.passed ? 'PASS' : 'FAIL';
    console.log(`  [${tag}] ${g.gate} (${g.name}): ${g.summary}`);
  }
  if (!postVerify.passed && !flags.force) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
