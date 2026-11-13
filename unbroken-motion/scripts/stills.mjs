#!/usr/bin/env node
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureDir,
  ensureWorkingDirOutsideSkill,
  parseArgs,
  readJson,
  resolveFfmpegBinaries,
  resolveFilmDir,
  runBin,
} from './common.mjs';
import { runVerification } from './verify.mjs';

function extractFramePngBase64(ffmpeg, videoPath, frameIndex, fps, tempPngPath) {
  // Seek accurately to frame midpoint (+0.15 frame) after -i to avoid H.264 PTS rounding to n-1
  const timestampSec = (frameIndex + 0.15) / Math.max(1, fps);
  runBin(ffmpeg, [
    '-y',
    '-i',
    videoPath,
    '-ss',
    timestampSec.toFixed(5),
    '-frames:v',
    '1',
    '-q:v',
    '2',
    tempPngPath,
  ]);
  const buf = fs.readFileSync(tempPngPath);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

export async function generateStillsForFilm(filmArg, options = {}) {
  const filmDir = resolveFilmDir(filmArg);
  ensureWorkingDirOutsideSkill(filmDir);
  const beats = readJson(path.join(filmDir, 'beats.json'));
  const manifest = readJson(path.join(filmDir, 'manifest.json'));
  const useVideoSeek = Boolean(options.fromVideo);
  const videoPath = options.videoPath
    ? path.resolve(options.videoPath)
    : path.join(filmDir, 'out', 'draft.mp4');

  let ffmpeg = null;
  if (useVideoSeek) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video not found for stills extraction: ${videoPath}`);
    }
    ({ ffmpeg } = resolveFfmpegBinaries(filmDir));
    if (!ffmpeg) {
      throw new Error('ffmpeg binary not found; cannot extract stills from video.');
    }
  }

  // Run verification to annotate PASS/FAIL on boundary rows
  const verifyReport = await runVerification(filmDir, { requireAudio: false });
  const boundaryMap = new Map(
    verifyReport.boundaries.map((b) => [b.boundaryFrame, b])
  );

  const stillsDir = path.join(filmDir, 'stills');
  const tmpDir = path.join(stillsDir, '.tmp');
  ensureDir(tmpDir);

  const W = manifest.resolution.width;
  const H = manifest.resolution.height;

  // Render DiagnosticSheet (and exact-frame stills) via Remotion
  const req = createRequire(path.join(filmDir, 'package.json'));
  const { bundle } = req('@remotion/bundler');
  const { openBrowser, selectComposition, renderStill } = req('@remotion/renderer');

  const bundleLocation =
    options.bundleLocation ||
    (await bundle({
      entryPoint: path.join(filmDir, 'src', 'index.ts'),
      onProgress: () => {},
    }));

  const browser = options.browser || (await openBrowser('chrome'));
  const closeBrowserHere = !options.browser;

  const boundaryOut = path.join(stillsDir, 'boundary-handoffs.png');
  const overviewOut = path.join(stillsDir, 'beat-overview.png');

  try {
    const filmProps = {
      shutterOffset: 0,
      enableDraftBlur: true,
    };
    const filmComp = useVideoSeek
      ? null
      : await selectComposition({
          serveUrl: bundleLocation,
          id: 'Film',
          inputProps: filmProps,
          puppeteerInstance: browser,
        });

    const frameCache = new Map();
    const getDataUrl = async (fIdx) => {
      const clamped = Math.max(0, Math.min(manifest.totalFrames - 1, fIdx));
      if (!frameCache.has(clamped)) {
        const pngPath = path.join(tmpDir, `f_${clamped}.png`);
        if (useVideoSeek) {
          frameCache.set(
            clamped,
            extractFramePngBase64(ffmpeg, videoPath, clamped, manifest.fps, pngPath)
          );
        } else {
          // Exact frame-indexed still guarantees pixel alignment with manifest boxes (avoids H.264 -ss drift)
          await renderStill({
            composition: filmComp,
            serveUrl: bundleLocation,
            frame: clamped,
            output: pngPath,
            inputProps: filmProps,
            puppeteerInstance: browser,
          });
          const buf = fs.readFileSync(pngPath);
          frameCache.set(clamped, `data:image/png;base64,${buf.toString('base64')}`);
        }
      }
      return frameCache.get(clamped);
    };

    // 1. Build boundary-handoffs.png rows
    const boundaryRows = [];
    for (let i = 0; i < beats.beats.length - 1; i++) {
      const b0 = beats.beats[i];
      const b1 = beats.beats[i + 1];
      const handoff = b0.handoff;
      if (!handoff) continue;
      const fb = Math.round(b1.start * manifest.fps);
      const diag = boundaryMap.get(fb);
      const rowStatus = diag?.passed ? 'PASS' : 'FAIL';
      const offsets = [-4, -2, 0, 2, 4];

      const tiles = [];
      for (const off of offsets) {
        const fIdx = Math.max(0, Math.min(manifest.totalFrames - 1, fb + off));
        const frameState = manifest.frames[fIdx];
        const isAfter = fIdx >= fb;
        const primaryId = isAfter ? handoff.targetActor : handoff.carryActor;
        const fallbackId = isAfter ? handoff.carryActor : handoff.targetActor;
        const actor =
          frameState.actors.find((a) => a.id === primaryId && a.visible) ??
          frameState.actors.find((a) => a.id === fallbackId && a.visible);

        const boxColor = rowStatus === 'PASS' ? '#22C55E' : '#EF4444';
        const boxes = actor
          ? [
              {
                id: actor.id,
                x: actor.screenBox.x,
                y: actor.screenBox.y,
                width: actor.screenBox.width,
                height: actor.screenBox.height,
                color: boxColor,
                label: `${actor.id} (op ${actor.opacity.toFixed(2)})`,
              },
            ]
          : [];

        tiles.push({
          title: `f${fIdx} (${off >= 0 ? `+${off}` : off})`,
          subtitle: `${(fIdx / manifest.fps).toFixed(2)}s`,
          imageDataUrl: await getDataUrl(fIdx),
          sourceWidth: W,
          sourceHeight: H,
          status: actor && actor.opacity >= 0.35 ? rowStatus : 'FAIL',
          boxes,
        });
      }

      boundaryRows.push({
        rowTitle: `${b0.id} → ${b1.id} (${handoff.mode}: ${handoff.carryActor} → ${handoff.targetActor})`,
        rowStatus,
        rowMetric: diag
          ? `IoU ${diag.minIoU} · jump ${diag.maxJump1080}px · areaR ${diag.maxAreaRatio} · Δpos ${diag.deltaPos1080}px · Δscale ${diag.deltaScalePct}%`
          : '',
        tiles,
      });
    }

    // 2. Build beat-overview.png rows (Start, Mid, Settle per beat)
    const overviewRows = [];
    for (const b of beats.beats) {
      const fStart = Math.round(b.start * manifest.fps);
      const fMid = Math.round((b.start + b.duration * 0.5) * manifest.fps);
      const fEnd = Math.max(
        fStart,
        Math.round((b.start + b.duration) * manifest.fps) - 2
      );
      const sampleFrames = [
        { f: fStart, tag: 'Start' },
        { f: fMid, tag: 'Mid' },
        { f: fEnd, tag: 'Settle' },
      ];

      const tiles = [];
      for (const { f, tag } of sampleFrames) {
        const fIdx = Math.max(0, Math.min(manifest.totalFrames - 1, f));
        const frameState = manifest.frames[fIdx];
        const hero =
          frameState.actors.find((a) => a.id === frameState.heroActorId && a.visible) ??
          frameState.actors[0];
        tiles.push({
          title: `${tag} (f${fIdx})`,
          subtitle: `cam v=${frameState.camera.speedNorm.toFixed(1)}`,
          imageDataUrl: await getDataUrl(fIdx),
          sourceWidth: W,
          sourceHeight: H,
          status: 'INFO',
          boxes: hero
            ? [
                {
                  id: hero.id,
                  x: hero.screenBox.x,
                  y: hero.screenBox.y,
                  width: hero.screenBox.width,
                  height: hero.screenBox.height,
                  color: '#38BDF8',
                  label: `${hero.id} (v=${hero.speedNorm.toFixed(1)})`,
                },
              ]
            : [],
        });
      }

      overviewRows.push({
        rowTitle: `${b.id} — ${b.label || b.camera.preset} (${b.duration.toFixed(2)}s)`,
        rowStatus: 'INFO',
        rowMetric: `cam=${b.camera.preset} zoom=${b.camera.zoom}x`,
        tiles,
      });
    }

    if (boundaryRows.length > 0) {
      const bProps = {
        sheetTitle: `${beats.film} — Boundary Handoffs`,
        sheetSubtitle: `Brand: ${beats.brand} | Carry Score: ${verifyReport.carryScore ?? 1} | Frames [fb-4 .. fb+4]`,
        rows: boundaryRows,
      };
      const compB = await selectComposition({
        serveUrl: bundleLocation,
        id: 'DiagnosticSheet',
        inputProps: bProps,
        puppeteerInstance: browser,
      });
      await renderStill({
        composition: compB,
        serveUrl: bundleLocation,
        output: boundaryOut,
        inputProps: bProps,
        puppeteerInstance: browser,
      });
    }

    const oProps = {
      sheetTitle: `${beats.film} — Beat Overview`,
      sheetSubtitle: `Brand: ${beats.brand} | ${beats.aspectRatio} | ${manifest.totalDurationSec.toFixed(2)}s (${manifest.totalFrames} frames @ ${manifest.fps}fps)`,
      rows: overviewRows,
    };
    const compO = await selectComposition({
      serveUrl: bundleLocation,
      id: 'DiagnosticSheet',
      inputProps: oProps,
      puppeteerInstance: browser,
    });
    await renderStill({
      composition: compO,
      serveUrl: bundleLocation,
      output: overviewOut,
      inputProps: oProps,
      puppeteerInstance: browser,
    });
  } finally {
    if (closeBrowserHere) {
      await browser.close({ silent: true });
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return { boundaryOut, overviewOut };
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCli) {
  const { flags } = parseArgs(process.argv.slice(2));
  if (!flags.film) {
    console.error(
      'Usage: node scripts/stills.mjs --film <name-or-path> [--from-video] [--video <mp4Path>]'
    );
    process.exit(1);
  }
  const res = await generateStillsForFilm(String(flags.film), {
    videoPath: flags.video ? String(flags.video) : undefined,
    fromVideo: Boolean(flags['from-video']),
  });
  console.log(`Generated diagnostic stills:\n  - ${res.boundaryOut}\n  - ${res.overviewOut}`);
}
