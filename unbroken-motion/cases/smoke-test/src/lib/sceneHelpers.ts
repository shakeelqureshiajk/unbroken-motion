import { computeBlurParams } from './blur.ts';
import {
  computeStageScale,
  getStageDimensions,
  solveCameraState,
  worldToScreenBox,
} from './camera.ts';
import { getActiveHandoff } from './carry.ts';
import type {
  ActorKind,
  ActorRole,
  BeatSheet,
  BrandTokens,
  CarryMode,
  EvaluatedActor,
  FrameSceneState,
  WorldBox,
} from './types.ts';

export interface RawActorSpec {
  id: string;
  kind: ActorKind;
  role: ActorRole;
  zIndex: number;
  worldBox: WorldBox;
  opacity: number;
  visible?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  fontsUsed?: string[];
  props?: Record<string, unknown>;
}

export type ActorEvaluator = (
  timeSec: number,
  brand: BrandTokens,
  beats: BeatSheet
) => RawActorSpec[];

/**
 * Wraps any pure-math RawActorSpec[] scene evaluator with unified camera solving,
 * stage-to-screen projection, finite-difference screen velocities, blur flags,
 * and brand token auditing. Used identically by Film.tsx and manifest.mjs.
 */
export function evaluateSceneWithCamera(
  beats: BeatSheet,
  brand: BrandTokens,
  continuousFrame: number,
  evalRawActors: ActorEvaluator
): FrameSceneState {
  const fps = beats.fps;
  const timeSec = Math.max(0, continuousFrame / fps);
  const stageSize = getStageDimensions(beats.aspectRatio);
  const stageScale = computeStageScale(beats.resolution, stageSize);

  const rawActorsNow = evalRawActors(timeSec, brand, beats);
  const halfFrameSec = 0.5 / fps;
  const rawActorsPrev = evalRawActors(
    Math.max(0, timeSec - halfFrameSec),
    brand,
    beats
  );
  const rawActorsNext = evalRawActors(timeSec + halfFrameSec, brand, beats);

  const prevById = new Map(rawActorsPrev.map((a) => [a.id, a]));
  const nextById = new Map(rawActorsNext.map((a) => [a.id, a]));

  const resolveTarget = (targetId: string, t: number) => {
    const list =
      Math.abs(t - timeSec) < 1e-6 ? rawActorsNow : evalRawActors(t, brand, beats);
    const match = list.find((a) => a.id === targetId);
    if (!match) return { x: 0, y: 0, vx: 0, vy: 0 };

    // Estimate world velocity for follow look-ahead
    const pPrev = prevById.get(targetId);
    const pNext = nextById.get(targetId);
    const dt = 1 / fps;
    const vx = pPrev && pNext ? (pNext.worldBox.cx - pPrev.worldBox.cx) / dt : 0;
    const vy = pPrev && pNext ? (pNext.worldBox.cy - pPrev.worldBox.cy) / dt : 0;
    return { x: match.worldBox.cx, y: match.worldBox.cy, vx, vy };
  };

  const camera = solveCameraState(
    beats.beats,
    beats.seed,
    brand.motionPersonality.cameraFloatIntensity,
    timeSec,
    fps,
    beats.resolution,
    stageScale,
    resolveTarget
  );

  // Also compute camera at t - halfFrame and t + halfFrame for exact screen velocity
  const camPrev = solveCameraState(
    beats.beats,
    beats.seed,
    brand.motionPersonality.cameraFloatIntensity,
    Math.max(0, timeSec - halfFrameSec),
    fps,
    beats.resolution,
    stageScale,
    resolveTarget
  );
  const camNext = solveCameraState(
    beats.beats,
    beats.seed,
    brand.motionPersonality.cameraFloatIntensity,
    timeSec + halfFrameSec,
    fps,
    beats.resolution,
    stageScale,
    resolveTarget
  );

  // Active beat lookup
  let beatIndex = 0;
  for (let i = 0; i < beats.beats.length; i++) {
    if (timeSec >= beats.beats[i].start) {
      beatIndex = i;
    }
  }
  const activeBeat = beats.beats[beatIndex];
  const activeHandoff = getActiveHandoff(beats.beats, timeSec);
  const heroActorId =
    activeBeat.heroActor ??
    activeBeat.handoff?.carryActor ??
    activeBeat.actors[0] ??
    '';

  const actors: EvaluatedActor[] = rawActorsNow.map((raw) => {
    const visible = (raw.visible ?? true) && raw.opacity > 0.005;
    const screenBox = worldToScreenBox(
      raw.worldBox,
      camera,
      beats.resolution,
      stageScale
    );

    const prevRaw = prevById.get(raw.id) ?? raw;
    const nextRaw = nextById.get(raw.id) ?? raw;
    const prevScreen = worldToScreenBox(
      prevRaw.worldBox,
      camPrev,
      beats.resolution,
      stageScale
    );
    const nextScreen = worldToScreenBox(
      nextRaw.worldBox,
      camNext,
      beats.resolution,
      stageScale
    );

    const vx = nextScreen.cx - prevScreen.cx;
    const vy = nextScreen.cy - prevScreen.cy;
    const blur = computeBlurParams(vx, vy, beats.resolution, fps);

    const inHandoff =
      activeHandoff !== null &&
      (raw.id === activeHandoff.handoff.carryActor ||
        raw.id === activeHandoff.handoff.targetActor);
    const handoffMode: CarryMode | null = inHandoff ? activeHandoff!.mode : null;

    const bgColor = raw.backgroundColor ?? brand.colors.surface;
    const borderCol = raw.borderColor ?? brand.colors.border;
    const textCol = raw.textColor ?? brand.colors.textPrimary;

    return {
      id: raw.id,
      kind: raw.kind,
      role: raw.role,
      zIndex: raw.zIndex,
      worldBox: raw.worldBox,
      screenBox,
      opacity: raw.opacity,
      visible,
      vx: blur.vx,
      vy: blur.vy,
      speedNorm: blur.speedNorm,
      blurEnabled: blur.blurEnabled || camera.blurEnabled,
      blurStrength: Math.max(blur.blurStrength, camera.blurStrength),
      blurAngleDeg: blur.blurEnabled ? blur.blurAngleDeg : camera.blurAngleDeg,
      inHandoff,
      handoffMode,
      backgroundColor: bgColor,
      borderColor: borderCol,
      textColor: textCol,
      tokensUsed: {
        colors: [bgColor, borderCol, textCol].filter(Boolean),
        fonts: raw.fontsUsed ?? [brand.typography.bodyFont],
        radii: [Math.round(raw.worldBox.borderRadius)],
      },
      props: raw.props ?? {},
    };
  });

  return {
    frame: continuousFrame,
    timeSec,
    fps,
    resolution: beats.resolution,
    stageSize,
    stageScale,
    beatIndex,
    beatId: activeBeat.id,
    heroActorId,
    camera,
    actors,
  };
}
