#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCHEMA_DIR,
  parseArgs,
  parseBrandFile,
  readJson,
  resolveFfmpegBinaries,
  resolveFilmDir,
  validateAgainstSchema,
} from './common.mjs';
import {
  SAMPLE_RATE,
  decodeAudioViaFfmpeg,
  measureLoudnessAndPeak,
} from './dsp.mjs';

function computeIoU(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const iw = Math.max(0, x2 - x1);
  const ih = Math.max(0, y2 - y1);
  const inter = iw * ih;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 1e-6 ? inter / union : 0;
}

function velocityCompIoU(a, b, vx, vy) {
  const shifted = {
    ...a,
    x: a.x + vx,
    y: a.y + vy,
    cx: a.cx + vx,
    cy: a.cy + vy,
  };
  return Math.max(computeIoU(a, b), computeIoU(shifted, b));
}

function getBoundaryActorOnFrame(frameState, handoff, isAfterBoundary) {
  const primaryId = isAfterBoundary ? handoff.targetActor : handoff.carryActor;
  const fallbackId = isAfterBoundary ? handoff.carryActor : handoff.targetActor;
  return (
    frameState.actors.find((a) => a.id === primaryId && a.visible) ??
    frameState.actors.find((a) => a.id === fallbackId && a.visible) ??
    frameState.actors.find((a) => a.id === primaryId) ??
    frameState.actors.find((a) => a.id === fallbackId) ??
    null
  );
}

function checkGate1(beats, beatsSchema, brandSchema) {
  const errors = [];
  errors.push(...validateAgainstSchema(beats, beatsSchema, '$'));

  let brandTokens = null;
  try {
    const parsed = parseBrandFile(beats.brand);
    brandTokens = parsed.tokens;
    errors.push(...validateAgainstSchema(brandTokens, brandSchema, 'brand'));
  } catch (err) {
    errors.push(`Brand load error: ${err.message}`);
  }

  if (Array.isArray(beats.beats) && beats.beats.length > 0) {
    if (Math.abs(beats.beats[0].start) > 1e-4) {
      errors.push(`beats[0].start must be 0, got ${beats.beats[0].start}`);
    }
    for (let i = 0; i < beats.beats.length - 1; i++) {
      const b0 = beats.beats[i];
      const b1 = beats.beats[i + 1];
      const expectedStart = b0.start + b0.duration;
      if (Math.abs(b1.start - expectedStart) > 1e-3) {
        errors.push(
          `Timeline gap/overlap at ${b0.id} -> ${b1.id}: expected start=${expectedStart.toFixed(3)}, got ${b1.start.toFixed(3)}`
        );
      }
      if (!b0.handoff) {
        errors.push(`Beat ${b0.id} (non-final) is missing required "handoff" object.`);
      } else {
        if (!b0.actors.includes(b0.handoff.carryActor)) {
          errors.push(
            `Beat ${b0.id}.handoff.carryActor "${b0.handoff.carryActor}" not present in ${b0.id}.actors`
          );
        }
        if (!b1.actors.includes(b0.handoff.targetActor)) {
          errors.push(
            `Beat ${b0.id}.handoff.targetActor "${b0.handoff.targetActor}" not present in ${b1.id}.actors`
          );
        }
        const maxWin = 0.5 * Math.min(b0.duration, b1.duration);
        if (b0.handoff.windowSec > maxWin + 1e-6) {
          errors.push(
            `Beat ${b0.id}.handoff.windowSec (${b0.handoff.windowSec}s) exceeds 0.5 * min(${b0.duration}, ${b1.duration}) = ${maxWin.toFixed(3)}s`
          );
        }
      }
    }
  }

  return {
    gate: 'G1',
    name: 'Schema & Carry Topology',
    passed: errors.length === 0,
    summary: errors.length === 0 ? 'Valid schema, contiguous timeline, closed carry graph' : `${errors.length} error(s)`,
    details: errors,
    brandTokens,
  };
}

function checkGate2(beats, manifest) {
  const frames = manifest.frames;
  const fps = manifest.fps;
  const { width: W, height: H } = manifest.resolution;
  const scaleTo1080 = 1920 / Math.max(1, W, H);
  const boundaries = [];
  const errors = [];

  for (let i = 0; i < beats.beats.length - 1; i++) {
    const b0 = beats.beats[i];
    const b1 = beats.beats[i + 1];
    const handoff = b0.handoff;
    if (!handoff) continue;

    const boundarySec = b1.start;
    const fb = Math.round(boundarySec * fps);
    const fStart = Math.max(0, fb - 3);
    const fEnd = Math.min(frames.length - 1, fb + 3);

    let minOpacity = 1;
    let maxJump1080 = 0;
    let maxAreaRatio = 1;
    let minIoU = 1;
    let survivalPass = true;
    let jumpPass = true;
    let areaPass = true;
    let iouPass = true;
    const reasons = [];

    let prevActor = null;
    for (let f = fStart; f <= fEnd; f++) {
      const isAfter = f >= fb;
      const actor = getBoundaryActorOnFrame(frames[f], handoff, isAfter);

      if (!actor || !actor.visible || actor.opacity < 0.35) {
        survivalPass = false;
        minOpacity = Math.min(minOpacity, actor ? actor.opacity : 0);
        reasons.push(`f${f}: carried actor missing/faded (opacity=${actor ? actor.opacity.toFixed(2) : 0})`);
        prevActor = actor;
        continue;
      }
      minOpacity = Math.min(minOpacity, actor.opacity);

      if (prevActor && prevActor.visible) {
        const dx = actor.screenBox.cx - prevActor.screenBox.cx;
        const dy = actor.screenBox.cy - prevActor.screenBox.cy;
        const jump1080 = Math.hypot(dx, dy) * scaleTo1080;
        const localVel1080 = Math.hypot(actor.vx, actor.vy) * scaleTo1080;
        const jumpLimit = Math.max(36, 1.35 * localVel1080);
        maxJump1080 = Math.max(maxJump1080, jump1080);

        if (jump1080 > jumpLimit) {
          jumpPass = false;
          reasons.push(`f${f}: centroid jump ${jump1080.toFixed(1)}px > ${jumpLimit.toFixed(1)}px`);
        }

        const areaPrev = Math.max(1, prevActor.screenBox.width * prevActor.screenBox.height);
        const areaCurr = Math.max(1, actor.screenBox.width * actor.screenBox.height);
        const areaRatio = Math.max(areaCurr / areaPrev, areaPrev / areaCurr);
        maxAreaRatio = Math.max(maxAreaRatio, areaRatio);
        if (areaRatio > 1.25) {
          areaPass = false;
          reasons.push(`f${f}: area ratio ${areaRatio.toFixed(2)} > 1.25`);
        }

        const iou = velocityCompIoU(
          prevActor.screenBox,
          actor.screenBox,
          prevActor.vx,
          prevActor.vy
        );
        minIoU = Math.min(minIoU, iou);
        if (iou < 0.55) {
          iouPass = false;
          reasons.push(`f${f}: velocity-comp IoU ${iou.toFixed(2)} < 0.55`);
        }
      }
      prevActor = actor;
    }

    // Anti-Static Cheat (G2.4): measure net transform across handoff window
    const halfWinFrames = Math.max(2, Math.round((handoff.windowSec * fps) / 2));
    const wStartF = Math.max(0, fb - halfWinFrames);
    const wEndF = Math.min(frames.length - 1, fb + halfWinFrames);
    const actorStart = getBoundaryActorOnFrame(frames[wStartF], handoff, false);
    const actorEnd = getBoundaryActorOnFrame(frames[wEndF], handoff, true);

    let deltaPos1080 = 0;
    let deltaScale = 0;
    let antiStaticPass = false;
    if (actorStart && actorEnd) {
      deltaPos1080 =
        Math.hypot(
          actorEnd.screenBox.cx - actorStart.screenBox.cx,
          actorEnd.screenBox.cy - actorStart.screenBox.cy
        ) * scaleTo1080;
      const rw =
        Math.max(
          actorEnd.screenBox.width / Math.max(1, actorStart.screenBox.width),
          actorStart.screenBox.width / Math.max(1, actorEnd.screenBox.width)
        ) - 1;
      const rh =
        Math.max(
          actorEnd.screenBox.height / Math.max(1, actorStart.screenBox.height),
          actorStart.screenBox.height / Math.max(1, actorEnd.screenBox.height)
        ) - 1;
      deltaScale = Math.max(rw, rh);
      antiStaticPass = deltaPos1080 > 24 || deltaScale > 0.15;
    }
    if (!antiStaticPass) {
      reasons.push(
        `Anti-static failed: Δpos=${deltaPos1080.toFixed(1)}px (need >24), Δscale=${(deltaScale * 100).toFixed(1)}% (need >15%)`
      );
    }

    const passed = survivalPass && jumpPass && areaPass && iouPass && antiStaticPass;
    if (!passed) {
      errors.push(`${b0.id}->${b1.id} (f${fb}): ${reasons.join('; ')}`);
    }

    boundaries.push({
      boundary: `${b0.id} -> ${b1.id}`,
      boundaryFrame: fb,
      mode: handoff.mode,
      carryActor: handoff.carryActor,
      targetActor: handoff.targetActor,
      passed,
      minOpacity: Number(minOpacity.toFixed(2)),
      maxJump1080: Number(maxJump1080.toFixed(1)),
      maxAreaRatio: Number(maxAreaRatio.toFixed(2)),
      minIoU: Number(minIoU.toFixed(2)),
      deltaPos1080: Number(deltaPos1080.toFixed(1)),
      deltaScalePct: Number((deltaScale * 100).toFixed(1)),
      reasons,
    });
  }

  const passedCount = boundaries.filter((b) => b.passed).length;
  const carryScore = boundaries.length > 0 ? passedCount / boundaries.length : 1;

  return {
    gate: 'G2',
    name: 'Boundary Continuity',
    passed: carryScore === 1.0,
    carryScore: Number(carryScore.toFixed(2)),
    summary: `carryScore=${carryScore.toFixed(2)} (${passedCount}/${boundaries.length} boundaries passed)`,
    boundaries,
    details: errors,
  };
}

function checkGate3(beats, manifest) {
  const durations = beats.beats.map((b) => b.duration);
  const errors = [];

  // G3.1 & G3.2: Duration dynamic range and coefficient of variation
  let ratio = 1;
  let cv = 0;
  if (durations.length >= 3) {
    const minD = Math.min(...durations);
    const maxD = Math.max(...durations);
    ratio = maxD / Math.max(0.001, minD);
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance =
      durations.reduce((acc, d) => acc + (d - mean) ** 2, 0) / durations.length;
    cv = Math.sqrt(variance) / Math.max(0.001, mean);

    if (ratio < 2.8) {
      errors.push(`Duration dynamic range max/min = ${ratio.toFixed(2)} < 2.80`);
    }
    if (cv < 0.28) {
      errors.push(`Duration CV (sigma/mu) = ${cv.toFixed(2)} < 0.28`);
    }
  }

  // G3.3: Global Rest Ratio (15% - 45%)
  const frames = manifest.frames;
  const scaleTo1080 = 1920 / Math.max(1, manifest.resolution.width, manifest.resolution.height);
  const fpsFactor = manifest.fps / 30;
  let restFrames = 0;
  const combinedSpeeds = [];

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const prevF = i > 0 ? frames[i - 1] : f;
    const hero = f.actors.find((a) => a.id === f.heroActorId) ?? f.actors[0];
    const prevHero = hero ? prevF.actors.find((a) => a.id === hero.id) : null;
    const morphRateNorm =
      hero && prevHero
        ? 0.5 *
          Math.hypot(
            hero.screenBox.width - prevHero.screenBox.width,
            hero.screenBox.height - prevHero.screenBox.height
          ) *
          scaleTo1080 *
          fpsFactor
        : 0;
    const heroSpeed = (hero ? hero.speedNorm : 0) + morphRateNorm;
    const camSpeed = f.camera.speedNorm;
    if (camSpeed < 1.5 && heroSpeed < 1.5) {
      restFrames++;
    }
    combinedSpeeds.push(Math.max(camSpeed, heroSpeed));
  }

  const restRatio = restFrames / Math.max(1, frames.length);
  if (restRatio < 0.15 || restRatio > 0.45) {
    errors.push(
      `Global rest ratio ${(restRatio * 100).toFixed(1)}% outside target [15%, 45%]`
    );
  }

  // G3.4: Post-Impulse Settle (>= 8 low-vel frames < 3.0 starting within 15 frames after >28 px/f burst)
  let inBurst = false;
  let settleViolations = 0;
  for (let i = 0; i < combinedSpeeds.length; i++) {
    if (combinedSpeeds[i] > 28) {
      inBurst = true;
    } else if (inBurst) {
      inBurst = false;
      // Burst just ended at frame i; ignore only if < 20 frames remain in film
      if (i + 20 < combinedSpeeds.length) {
        let foundSettle = false;
        const searchEnd = Math.min(combinedSpeeds.length - 8, i + 15);
        for (let s = i; s <= searchEnd; s++) {
          let ok = true;
          for (let k = 0; k < 8; k++) {
            if (combinedSpeeds[s + k] >= 3.0) {
              ok = false;
              break;
            }
          }
          if (ok) {
            foundSettle = true;
            break;
          }
        }
        if (!foundSettle) {
          settleViolations++;
          errors.push(`f${i}: high-speed impulse (>28 px/f) lacked 8-frame settle window within 15 frames`);
        }
      }
    }
  }

  return {
    gate: 'G3',
    name: 'Rhythm & Pacing',
    passed: errors.length === 0,
    summary: `ratio=${ratio.toFixed(2)}, CV=${cv.toFixed(2)}, rest=${(restRatio * 100).toFixed(1)}%, settleViolations=${settleViolations}`,
    metrics: {
      dynamicRange: Number(ratio.toFixed(2)),
      cv: Number(cv.toFixed(2)),
      restPct: Number((restRatio * 100).toFixed(1)),
      settleViolations,
    },
    details: errors,
  };
}

function checkGate4(manifest) {
  const { width: W, height: H } = manifest.resolution;
  const minX = 0.05 * W - 6;
  const maxX = 0.95 * W + 6;
  const minY = 0.05 * H - 6;
  const maxY = 0.95 * H + 6;
  const violations = [];

  for (const f of manifest.frames) {
    const hero = f.actors.find((a) => a.id === f.heroActorId && a.visible);
    if (!hero) continue;

    // Portal exemption (RC-002)
    if (hero.handoffMode === 'portal' && hero.screenBox.areaRatio > 0.65) {
      continue;
    }

    // Check during hold/read phases (or any time not in fast whip)
    if (hero.speedNorm < 14 && f.camera.speedNorm < 14) {
      const sb = hero.screenBox;
      if (
        sb.x < minX ||
        sb.x + sb.width > maxX ||
        sb.y < minY ||
        sb.y + sb.height > maxY
      ) {
        violations.push(
          `f${f.frame} (${hero.id}): box [${Math.round(sb.x)},${Math.round(sb.y)},${Math.round(sb.x + sb.width)},${Math.round(sb.y + sb.height)}] exits 90% safe zone`
        );
      }
    }
  }

  return {
    gate: 'G4',
    name: 'Framing & Safe Zone',
    passed: violations.length === 0,
    summary: violations.length === 0 ? '0 out-of-bounds hero frames' : `${violations.length} frame(s) outside 90% safe zone`,
    details: violations.slice(0, 10),
  };
}

function checkGate5(manifest) {
  const missingBlur = [];
  let fastFrames = 0;

  for (const f of manifest.frames) {
    if (f.camera.speedNorm > 20) {
      fastFrames++;
      if (!f.camera.blurEnabled || f.camera.blurStrength <= 0) {
        missingBlur.push(`f${f.frame}: camera speed ${f.camera.speedNorm.toFixed(1)} > 20 without blur`);
      }
    }
    for (const a of f.actors) {
      if (a.visible && a.speedNorm > 20) {
        fastFrames++;
        if (!a.blurEnabled || a.blurStrength <= 0) {
          missingBlur.push(`f${f.frame} (${a.id}): speed ${a.speedNorm.toFixed(1)} > 20 without blur`);
        }
      }
    }
  }

  return {
    gate: 'G5',
    name: 'Velocity Motion Blur',
    passed: missingBlur.length === 0,
    summary:
      missingBlur.length === 0
        ? `100% compliant (${fastFrames} high-speed samples with active blur)`
        : `${missingBlur.length} fast sample(s) missing blur`,
    details: missingBlur.slice(0, 10),
  };
}

function checkGate6(filmDir, beats, requireAudio, explicitVideoPath = null) {
  const draftPath = explicitVideoPath || path.join(filmDir, 'out', 'draft.mp4');
  const wavPath = path.join(filmDir, 'audio', 'master.wav');
  const { ffmpeg, ffprobe } = resolveFfmpegBinaries(filmDir);

  let audioSource = null;
  if (explicitVideoPath && fs.existsSync(explicitVideoPath) && ffprobe) {
    try {
      const probeOut = execFileSync(
        ffprobe,
        ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', explicitVideoPath],
        { encoding: 'utf8', windowsHide: true }
      );
      if (probeOut.trim().length > 0) {
        audioSource = explicitVideoPath;
      }
    } catch {
      // Fallback below
    }
  }
  if (!audioSource && fs.existsSync(wavPath)) {
    audioSource = wavPath;
  } else if (!audioSource && fs.existsSync(draftPath) && ffprobe) {
    try {
      const probeOut = execFileSync(
        ffprobe,
        ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', draftPath],
        { encoding: 'utf8', windowsHide: true }
      );
      if (probeOut.trim().length > 0) {
        audioSource = draftPath;
      }
    } catch {
      // No audio stream yet
    }
  }

  if (!audioSource) {
    return {
      gate: 'G6',
      name: 'Audio Integrity',
      passed: !requireAudio,
      skipped: !requireAudio,
      summary: requireAudio ? 'FAIL: No audio master found' : 'SKIPPED (no audio mixed yet; run sound.mjs)',
      details: requireAudio ? ['Missing audio/master.wav or audio stream in draft.mp4'] : [],
    };
  }

  if (!ffmpeg) {
    return {
      gate: 'G6',
      name: 'Audio Integrity',
      passed: false,
      summary: 'FAIL: ffmpeg binary not found for audio inspection',
      details: ['Install ffmpeg or Remotion compositor binaries'],
    };
  }

  return evaluateAudioWithSpawn(ffmpeg, audioSource, beats);
}

function evaluateAudioWithSpawn(ffmpeg, audioSource, beats) {
  const errors = [];
  let decoded;
  try {
    decoded = decodeAudioViaFfmpeg(ffmpeg, audioSource);
  } catch (err) {
    return {
      gate: 'G6',
      name: 'Audio Integrity',
      passed: false,
      summary: `FAIL: ${err.message}`,
      details: [err.message],
    };
  }

  const { integratedLufs: integrated, truePeakDbtp: truePeak } =
    measureLoudnessAndPeak(decoded.left, decoded.right, decoded.sampleRate);

  if (truePeak > -1.0) {
    errors.push(`Audio True Peak ${truePeak.toFixed(2)} dBTP exceeds -1.0 dBTP limit`);
  }
  if (integrated < -16.5 || integrated > -11.5) {
    errors.push(`Integrated loudness ${integrated.toFixed(1)} LUFS outside -14 +/- 2 LUFS window`);
  }

  // Transient alignment check against declared impact/whoosh events
  const events = (beats.beats || [])
    .flatMap((b) => b.audioEvents || [])
    .filter((ev) => ev.type === 'impact' || ev.type === 'whoosh' || ev.type === 'whoosh-soft');

  let misaligned = 0;
  if (events.length > 0) {
    const bucketSamples = Math.round(0.01 * SAMPLE_RATE); // 10ms buckets
    const bucketCount = Math.floor(decoded.left.length / bucketSamples);
    const env = new Float32Array(bucketCount);
    for (let b = 0; b < bucketCount; b++) {
      let sum = 0;
      const base = b * bucketSamples;
      for (let k = 0; k < bucketSamples; k++) {
        const mono = 0.5 * (decoded.left[base + k] + decoded.right[base + k]);
        sum += mono * mono;
      }
      env[b] = Math.sqrt(sum / bucketSamples);
    }

    const globalSorted = Array.from(env).sort((a, b) => a - b);
    const medianEnv = globalSorted[Math.floor(globalSorted.length * 0.5)] || 0.001;

    for (const ev of events) {
      const centerMs = Math.round(ev.atSec * 1000);
      const tolMs = ev.type === 'impact' ? 75 : 220;
      const startB = Math.max(0, Math.floor((centerMs - tolMs) / 10));
      const endB = Math.min(bucketCount - 1, Math.ceil((centerMs + tolMs) / 10));
      let localPeak = 0;
      for (let b = startB; b <= endB; b++) {
        if (env[b] > localPeak) localPeak = env[b];
      }
      if (localPeak < Math.max(0.015, medianEnv * 1.08)) {
        misaligned++;
        errors.push(`Audio event "${ev.type}" at ${ev.atSec.toFixed(2)}s lacks transient peak (peak=${localPeak.toFixed(4)})`);
      }
    }
  }

  return {
    gate: 'G6',
    name: 'Audio Integrity',
    passed: errors.length === 0,
    summary: `I=${integrated.toFixed(1)} LUFS, Peak=${truePeak.toFixed(2)} dBTP, events=${events.length - misaligned}/${events.length} aligned`,
    details: errors,
  };
}

function hexToRgbVec(hex) {
  const clean = hex.replace('#', '').slice(0, 6);
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function isInterpolatedPaletteColor(hex, paletteVecs) {
  if (!/^#[0-9A-F]{6}$/.test(hex)) return false;
  const p = hexToRgbVec(hex);
  for (let i = 0; i < paletteVecs.length; i++) {
    const a = paletteVecs[i];
    if (Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]) <= 3.5) {
      return true;
    }
    for (let j = i + 1; j < paletteVecs.length; j++) {
      const b = paletteVecs[j];
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
      const abLen2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
      if (abLen2 < 1e-6) continue;
      const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / abLen2));
      const proj = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
      const dist = Math.hypot(p[0] - proj[0], p[1] - proj[1], p[2] - proj[2]);
      if (dist <= 3.5) return true;
    }
  }
  return false;
}

function checkGate7(filmDir, beats, manifest, brandTokens) {
  const errors = [];
  if (!brandTokens) {
    return {
      gate: 'G7',
      name: 'Brand Isolation',
      passed: false,
      summary: 'No brand loaded',
      details: ['Cannot verify brand isolation without valid brand file'],
    };
  }

  // 1. Check src/brand.json matches brandTokens
  const brandJsonPath = path.join(filmDir, 'src', 'brand.json');
  if (!fs.existsSync(brandJsonPath)) {
    errors.push('Missing src/brand.json');
  } else {
    const localBrand = readJson(brandJsonPath);
    if (localBrand.id !== brandTokens.id) {
      errors.push(`src/brand.json id="${localBrand.id}" mismatches beats.brand="${brandTokens.id}"`);
    }
  }

  // 2. Check manifest tokens against allowed palette (+ valid intra-brand morph blends) & forbiddenColors
  const allowedList = Object.values(brandTokens.colors).map((c) => c.toUpperCase());
  const allowedColors = new Set(allowedList);
  const paletteVecs = allowedList.map(hexToRgbVec);
  const forbiddenColors = new Set(
    (brandTokens.forbiddenColors || []).map((c) => c.toUpperCase())
  );
  const leakedColors = new Set();

  for (const f of manifest.frames) {
    for (const a of f.actors) {
      for (const col of a.tokensUsed?.colors || []) {
        const up = String(col).toUpperCase().slice(0, 7);
        if (forbiddenColors.has(up)) {
          leakedColors.add(up);
        } else if (!allowedColors.has(up) && !isInterpolatedPaletteColor(up, paletteVecs)) {
          leakedColors.add(up);
        }
      }
    }
  }
  for (const c of leakedColors) {
    errors.push(`Manifest actor rendered unauthorized color ${c} outside brand "${brandTokens.id}"`);
  }

  // 3. Static source scan on src/scene.ts and src/compositions/Film.tsx
  const filesToScan = [
    path.join(filmDir, 'src', 'scene.ts'),
    path.join(filmDir, 'src', 'compositions', 'Film.tsx'),
  ];
  for (const file of filesToScan) {
    if (!fs.existsSync(file)) continue;
    const code = fs.readFileSync(file, 'utf8');
    const rel = path.relative(filmDir, file);
    if (/#[0-9A-Fa-f]{3,8}\b/.test(code) || /\brgba?\s*\(/.test(code)) {
      errors.push(`${rel}: contains hardcoded hex/rgb color literal (must read from brand.colors.*)`);
    }
    if (/\bMath\.random\s*\(/.test(code) || /\bDate\.now\s*\(/.test(code)) {
      errors.push(`${rel}: non-deterministic Math.random() or Date.now() found`);
    }
    if (/\buseCurrentFrame\s*\(/.test(code)) {
      errors.push(`${rel}: direct useCurrentFrame() bypasses useContinuousFrame()`);
    }
  }

  return {
    gate: 'G7',
    name: 'Brand Isolation & Determinism',
    passed: errors.length === 0,
    summary: errors.length === 0 ? `Brand "${brandTokens.id}" 100% isolated & pure` : `${errors.length} violation(s)`,
    details: errors,
  };
}

export async function runVerification(filmArg, options = {}) {
  const filmDir = resolveFilmDir(filmArg);
  const beats = readJson(path.join(filmDir, 'beats.json'));
  const beatsSchema = readJson(path.join(SCHEMA_DIR, 'beats.schema.json'));
  const brandSchema = readJson(path.join(SCHEMA_DIR, 'brand.schema.json'));

  const g1 = checkGate1(beats, beatsSchema, brandSchema);
  if (options.schemaOnly) {
    return {
      film: beats.film,
      filmDir,
      schemaOnly: true,
      passed: g1.passed,
      gates: [g1],
      boundaries: [],
    };
  }

  const manifestPath = path.join(filmDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing manifest.json at ${manifestPath}. Run scripts/manifest.mjs first.`);
  }
  const manifest = readJson(manifestPath);

  const g2 = checkGate2(beats, manifest);
  const g3 = checkGate3(beats, manifest);
  const g4 = checkGate4(manifest);
  const g5 = checkGate5(manifest);
  const g6 = checkGate6(filmDir, beats, Boolean(options.requireAudio), options.videoPath || null);
  const g7 = checkGate7(filmDir, beats, manifest, g1.brandTokens);

  const gates = [g1, g2, g3, g4, g5, g6, g7];
  const passed = gates.every((g) => g.passed);

  return {
    film: beats.film,
    filmDir,
    schemaOnly: false,
    passed,
    carryScore: g2.carryScore,
    gates,
    boundaries: g2.boundaries,
  };
}

function printReport(report) {
  console.log(`\n=== UNBROKEN MOTION VERIFY: ${report.film} ===`);
  for (const g of report.gates) {
    const tag = g.skipped ? 'SKIP' : g.passed ? 'PASS' : 'FAIL';
    console.log(`[${tag}] ${g.gate} (${g.name}): ${g.summary}`);
    if (!g.passed && g.details && g.details.length > 0) {
      for (const d of g.details) {
        console.log(`       - ${d}`);
      }
    }
  }
  if (report.boundaries && report.boundaries.length > 0) {
    console.log('\n--- Per-Boundary Breakdown ---');
    for (const b of report.boundaries) {
      console.log(
        `[${b.passed ? 'PASS' : 'FAIL'}] ${b.boundary} @f${b.boundaryFrame} (${b.mode}): ` +
          `opacity>=${b.minOpacity}, jump=${b.maxJump1080}px, areaRatio=${b.maxAreaRatio}, IoU=${b.minIoU}, ` +
          `Δpos=${b.deltaPos1080}px, Δscale=${b.deltaScalePct}%`
      );
      for (const r of b.reasons) {
        console.log(`       ! ${r}`);
      }
    }
  }
  console.log(`\nOVERALL: ${report.passed ? 'PASS' : 'FAIL'}\n`);
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCli) {
  const { flags } = parseArgs(process.argv.slice(2));
  if (!flags.film) {
    console.error('Usage: node scripts/verify.mjs --film <name-or-path> [--schema-only] [--require-audio] [--json]');
    process.exit(1);
  }
  const report = await runVerification(String(flags.film), {
    schemaOnly: Boolean(flags['schema-only']),
    requireAudio: Boolean(flags['require-audio']),
  });
  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }
  process.exit(report.passed ? 0 : 1);
}
