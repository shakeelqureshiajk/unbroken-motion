import { computeBlurParams } from './blur.ts';
import { clamp01, evaluateCurve, lerp } from './easing.ts';
import { fbm2D } from './noise.ts';
import type {
  AspectRatio,
  BeatDef,
  CameraPreset,
  CurvePreset,
  EvaluatedCamera,
  Resolution,
  ScreenBox,
  WorldBox,
} from './types.ts';

export function getStageDimensions(aspectRatio: AspectRatio): Resolution {
  switch (aspectRatio) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '16:9':
    default:
      return { width: 1920, height: 1080 };
  }
}

export function computeStageScale(
  resolution: Resolution,
  stageSize: Resolution
): number {
  return Math.min(
    resolution.width / stageSize.width,
    resolution.height / stageSize.height
  );
}

/**
 * Projects a center-origin stage WorldBox through the active camera into screen pixels.
 */
export function worldToScreenBox(
  worldBox: WorldBox,
  camera: { x: number; y: number; zoom: number; roll: number },
  resolution: Resolution,
  stageScale: number
): ScreenBox {
  const dx = worldBox.cx - camera.x;
  const dy = worldBox.cy - camera.y;
  const rad = (camera.roll * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rx = dx * cos + dy * sin;
  const ry = -dx * sin + dy * cos;

  const totalScale = camera.zoom * stageScale;
  const cx = resolution.width / 2 + rx * totalScale;
  const cy = resolution.height / 2 + ry * totalScale;
  const width = worldBox.width * worldBox.scale * totalScale;
  const height = worldBox.height * worldBox.scale * totalScale;

  const viewportArea = Math.max(1, resolution.width * resolution.height);
  return {
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    cx,
    cy,
    areaRatio: (width * height) / viewportArea,
  };
}

export interface CameraTargetPoint {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

export type TargetResolver = (
  targetId: string,
  timeSec: number,
  beat: BeatDef
) => CameraTargetPoint;

interface RawPose {
  x: number;
  y: number;
  zoom: number;
  roll: number;
  trauma: number;
  activePreset: CameraPreset;
}

function getBeatBasePose(
  beat: BeatDef,
  timeSec: number,
  resolveTarget: TargetResolver
): { x: number; y: number; zoom: number; roll: number } {
  let x = beat.camera.x ?? 0;
  let y = beat.camera.y ?? 0;

  if (beat.camera.x === undefined || beat.camera.y === undefined) {
    if (beat.camera.target !== 'stage') {
      // Clamp sampling time into the beat's own lifespan so cross-beat blending
      // never queries an incoming/outgoing actor before it spawns or after it despawns.
      const minT = beat.start + Math.min(0.02, beat.duration * 0.1);
      const maxT = beat.start + Math.max(minT - beat.start, beat.duration - 0.02);
      const sampleT = Math.max(minT, Math.min(maxT, timeSec));
      const pt = resolveTarget(beat.camera.target, sampleT, beat);
      if (beat.camera.x === undefined) {
        const lead = beat.camera.preset === 'follow' ? 0.12 : 0;
        x = pt.x + (pt.vx ?? 0) * lead;
      }
      if (beat.camera.y === undefined) {
        const lead = beat.camera.preset === 'follow' ? 0.12 : 0;
        y = pt.y + (pt.vy ?? 0) * lead;
      }
    }
  }

  return {
    x,
    y,
    zoom: beat.camera.zoom,
    roll: beat.camera.roll ?? 0,
  };
}

function transitionCurveForPreset(
  preset: CameraPreset,
  fallbackCurve: CurvePreset
): CurvePreset {
  if (preset === 'whip') return 'whipQuart';
  if (preset === 'pushThrough') return 'heavy';
  if (preset === 'follow') return 'snappy';
  return fallbackCurve;
}

function evaluateRawCameraPose(
  beats: BeatDef[],
  seed: number,
  brandFloatIntensity: number,
  timeSec: number,
  resolveTarget: TargetResolver
): RawPose {
  if (beats.length === 0) {
    return { x: 0, y: 0, zoom: 1, roll: 0, trauma: 0, activePreset: 'hold' };
  }

  // Locate active beat index
  let beatIdx = 0;
  for (let i = 0; i < beats.length; i++) {
    if (timeSec >= beats[i].start) {
      beatIdx = i;
    }
  }

  const activeBeat = beats[beatIdx];
  let pose = getBeatBasePose(activeBeat, timeSec, resolveTarget);
  let activePreset = activeBeat.camera.preset;

  // Apply centered smooth transition across any active beat boundary
  for (let i = 0; i < beats.length - 1; i++) {
    const outgoing = beats[i];
    const incoming = beats[i + 1];
    const boundarySec = incoming.start;
    const rawWin =
      incoming.camera.entryBlendSec ?? outgoing.handoff?.windowSec ?? 0.45;
    const maxSafe = 0.48 * Math.min(outgoing.duration, incoming.duration);
    const win = Math.max(0.18, Math.min(rawWin, maxSafe));
    const winStart = boundarySec - win * 0.5;
    const winEnd = boundarySec + win * 0.5;

    if (timeSec >= winStart && timeSec <= winEnd) {
      const u = clamp01((timeSec - winStart) / win);
      const curve = transitionCurveForPreset(
        incoming.camera.preset,
        outgoing.handoff?.curve ?? 'snappy'
      );
      const eased = evaluateCurve(curve, u, win);

      const fromPose = getBeatBasePose(outgoing, timeSec, resolveTarget);
      const toPose = getBeatBasePose(incoming, timeSec, resolveTarget);

      // Logarithmic zoom interpolation for uniform optical scale velocity
      const lnZ0 = Math.log(Math.max(0.05, fromPose.zoom));
      const lnZ1 = Math.log(Math.max(0.05, toPose.zoom));
      let zoom = Math.exp(lerp(lnZ0, lnZ1, eased));

      // Whip pans breathe slightly back mid-flight so spatial travel feels physical
      if (incoming.camera.preset === 'whip') {
        const dip = 1 - 0.11 * Math.sin(Math.PI * clamp01(u));
        zoom *= dip;
      }

      pose = {
        x: lerp(fromPose.x, toPose.x, eased),
        y: lerp(fromPose.y, toPose.y, eased),
        zoom,
        roll: lerp(fromPose.roll, toPose.roll, eased),
      };
      activePreset = incoming.camera.preset;
      break;
    }
  }

  // Organic seeded handheld float
  const beatFloat = activeBeat.camera.floatIntensity;
  const effectiveFloat =
    beatFloat !== undefined
      ? beatFloat
      : activePreset === 'float'
      ? Math.max(0.35, brandFloatIntensity)
      : activePreset === 'hold'
      ? brandFloatIntensity * 0.25
      : brandFloatIntensity * 0.2;

  if (effectiveFloat > 0) {
    const zoomDamp = 1 / Math.sqrt(Math.max(0.5, pose.zoom));
    pose.x += 10 * effectiveFloat * zoomDamp * fbm2D(seed + 11, timeSec * 0.42, 0.2);
    pose.y += 7 * effectiveFloat * zoomDamp * fbm2D(seed + 29, timeSec * 0.37, 1.7);
    pose.roll += 0.35 * effectiveFloat * zoomDamp * fbm2D(seed + 53, timeSec * 0.29, 3.1);
  }

  // Trauma / impact shake impulses across all beats
  let totalTrauma = 0;
  for (const beat of beats) {
    const intensity = beat.camera.shakeIntensity ?? (beat.camera.preset === 'shake' ? 12 : 0);
    if (intensity <= 0) continue;
    const shakeStart = beat.start + (beat.camera.shakeAtSec ?? 0);
    const dt = timeSec - shakeStart;
    if (dt >= 0 && dt < 0.65) {
      const decay = Math.exp(-11 * dt);
      const trauma = intensity * decay;
      totalTrauma = Math.max(totalTrauma, trauma / Math.max(1, intensity));
      pose.x += trauma * Math.sin(46 * dt + 0.4);
      pose.y += trauma * 0.85 * Math.cos(53 * dt + 1.1);
      pose.roll += trauma * 0.04 * Math.sin(39 * dt);
    }
  }

  return {
    ...pose,
    trauma: clamp01(totalTrauma),
    activePreset,
  };
}

/**
 * Evaluates full continuous camera state including finite-difference velocity
 * and Gate G5 velocity-coupled motion blur metadata.
 */
export function solveCameraState(
  beats: BeatDef[],
  seed: number,
  brandFloatIntensity: number,
  timeSec: number,
  fps: number,
  resolution: Resolution,
  stageScale: number,
  resolveTarget: TargetResolver
): EvaluatedCamera {
  const pose = evaluateRawCameraPose(
    beats,
    seed,
    brandFloatIntensity,
    timeSec,
    resolveTarget
  );

  // Sample half-frame before and after to compute exact instantaneous velocity (px/frame)
  const halfStepSec = 0.5 / Math.max(1, fps);
  const prevPose = evaluateRawCameraPose(
    beats,
    seed,
    brandFloatIntensity,
    Math.max(0, timeSec - halfStepSec),
    resolveTarget
  );
  const nextPose = evaluateRawCameraPose(
    beats,
    seed,
    brandFloatIntensity,
    timeSec + halfStepSec,
    resolveTarget
  );

  // Pan displacement in screen pixels per frame + zoom-induced radial flow equivalent
  const dxScreen = (nextPose.x - prevPose.x) * pose.zoom * stageScale;
  const dyScreen = (nextPose.y - prevPose.y) * pose.zoom * stageScale;
  const dLogZoom = Math.abs(Math.log(Math.max(0.05, nextPose.zoom)) - Math.log(Math.max(0.05, prevPose.zoom)));
  const zoomFlowPx = dLogZoom * Math.min(resolution.width, resolution.height) * 0.35;

  const vx = -dxScreen;
  const vy = -dyScreen;
  const combinedSpeedPx = Math.hypot(vx, vy) + zoomFlowPx;
  const blur = computeBlurParams(
    combinedSpeedPx > 0 && Math.hypot(vx, vy) < 1e-4 ? zoomFlowPx : vx,
    vy,
    resolution,
    fps
  );
  // Ensure radial zoom speed contributes to speedNorm & blurStrength
  const speedNorm =
    (combinedSpeedPx * (1920 / Math.max(resolution.width, resolution.height)) * fps) / 30;
  const blurEnabled = speedNorm > 20;
  const blurStrength = blurEnabled
    ? Math.min(28, 2 + Math.max(0, speedNorm - 20) * 0.38)
    : 0;

  return {
    x: pose.x,
    y: pose.y,
    zoom: pose.zoom,
    roll: pose.roll,
    vx,
    vy,
    speedNorm,
    trauma: pose.trauma,
    blurEnabled,
    blurStrength,
    blurAngleDeg: blur.blurAngleDeg,
    activePreset: pose.activePreset,
  };
}
