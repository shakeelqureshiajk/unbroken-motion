#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  parseArgs,
  readJson,
  resolveFilmDir,
  syncFilmBrandJson,
  writeJson,
} from './common.mjs';

export async function generateManifestForFilm(filmArg) {
  const filmDir = resolveFilmDir(filmArg);
  const beatsPath = path.join(filmDir, 'beats.json');
  const scenePath = path.join(filmDir, 'src', 'scene.ts');

  if (!fs.existsSync(beatsPath)) {
    throw new Error(`Missing beats.json at ${beatsPath}`);
  }
  if (!fs.existsSync(scenePath)) {
    throw new Error(`Missing src/scene.ts at ${scenePath}`);
  }

  const beats = readJson(beatsPath);
  const { tokens: brand } = syncFilmBrandJson(filmDir, beats.brand);

  const t0 = performance.now();
  // Cache-bust query string so repeated loops in one process reload edited scene.ts
  const sceneUrl = `${pathToFileURL(scenePath).href}?t=${Date.now()}`;
  const sceneMod = await import(sceneUrl);
  if (typeof sceneMod.evaluateFilmFrame !== 'function') {
    throw new Error(`src/scene.ts must export evaluateFilmFrame(beats, brand, continuousFrame).`);
  }

  const lastBeat = beats.beats[beats.beats.length - 1];
  const totalDurationSec = lastBeat ? lastBeat.start + lastBeat.duration : 0;
  const totalFrames = Math.max(1, Math.round(totalDurationSec * beats.fps));

  const frames = [];
  for (let f = 0; f < totalFrames; f++) {
    frames.push(sceneMod.evaluateFilmFrame(beats, brand, f));
  }

  const evalDurationMs = Math.round((performance.now() - t0) * 100) / 100;
  const manifest = {
    film: beats.film,
    brand: beats.brand,
    fps: beats.fps,
    aspectRatio: beats.aspectRatio,
    resolution: beats.resolution,
    totalFrames,
    totalDurationSec,
    generatedAt: new Date().toISOString(),
    evalDurationMs,
    frames,
  };

  const outPath = path.join(filmDir, 'manifest.json');
  writeJson(outPath, manifest);
  return { filmDir, manifest, outPath };
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCli) {
  const { flags } = parseArgs(process.argv.slice(2));
  if (!flags.film) {
    console.error('Usage: node scripts/manifest.mjs --film <name-or-path>');
    process.exit(1);
  }
  const { manifest, outPath } = await generateManifestForFilm(String(flags.film));
  console.log(
    `Generated manifest (${manifest.totalFrames} frames, ${manifest.totalDurationSec.toFixed(2)}s) in ${manifest.evalDurationMs} ms -> ${outPath}`
  );
}
