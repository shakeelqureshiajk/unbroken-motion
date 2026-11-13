import { interpolateWorldBox, lerpHexColor } from './lib/carry.ts';
import { clamp01, evaluateCurve, lerp, smoothstep, windowProgress } from './lib/easing.ts';
import { evaluateSceneWithCamera, type RawActorSpec } from './lib/sceneHelpers.ts';
import type { BeatSheet, BrandTokens, FrameSceneState, WorldBox } from './lib/types.ts';

function computeGoodCarryActors(
  timeSec: number,
  brand: BrandTokens
): RawActorSpec[] {
  const b1End = 1.2;
  const h1Start = b1End - 0.29; // 0.91s
  const h1End = b1End + 0.29;   // 1.49s

  const b2End = 4.2;
  const h2Start = b2End - 0.27; // 3.93s
  const h2End = b2End + 0.27;   // 4.47s

  const b3End = 5.6;
  const h3Start = b3End - 0.28; // 5.32s
  const h3End = b3End + 0.28;   // 5.88s

  // 1. Seed enters along curved arc
  const enterU = evaluateCurve('snappy', windowProgress(timeSec, 0, 0.72), 0.72);
  const dotRestBox: WorldBox = {
    cx: -140,
    cy: 0,
    width: 112,
    height: 112,
    borderRadius: 56,
    rotation: 0,
    scale: 1,
  };
  const promptStartBox: WorldBox = {
    cx: -40,
    cy: 0,
    width: 680,
    height: 150,
    borderRadius: brand.geometry.radiusMd,
    rotation: 0,
    scale: 1,
  };
  const promptGlideU = smoothstep(0, 1, windowProgress(timeSec, 1.78, 2.0));
  const promptEndBox: WorldBox = {
    ...promptStartBox,
    cx: lerp(-40, 220, promptGlideU),
  };

  const tetherOrigin: WorldBox = {
    cx: 220,
    cy: 0,
    width: 390,
    height: 220,
    borderRadius: 48,
    rotation: 0,
    scale: 1,
  };

  const portalCardBox: WorldBox = {
    cx: 1280,
    cy: 0,
    width: 580,
    height: 330,
    borderRadius: brand.geometry.radiusLg,
    rotation: 0,
    scale: 1,
  };

  const brandResolveBox: WorldBox = {
    cx: 1280,
    cy: 0,
    width: 310,
    height: 120,
    borderRadius: brand.geometry.radiusMd,
    rotation: 0,
    scale: 1,
  };

  const actors: RawActorSpec[] = [];

  // Beat 1: seedOrb -> morphs into promptCard
  if (timeSec <= b1End + 0.05) {
    const appear = evaluateCurve('overshoot', windowProgress(timeSec, 0, 0.3), 0.3);
    const seedMoving: WorldBox = {
      ...dotRestBox,
      cx: timeSec < h1Start ? lerp(-340, -140, enterU) : dotRestBox.cx,
      cy: timeSec < h1Start ? lerp(110, 0, enterU) : dotRestBox.cy,
      scale: Math.max(0.25, appear),
    };
    const uM = windowProgress(timeSec, h1Start, h1End - h1Start);
    const box =
      timeSec < h1Start
        ? seedMoving
        : interpolateWorldBox(dotRestBox, promptStartBox, uM, 'soft', 0.58);

    actors.push({
      id: 'seedOrb',
      kind: timeSec < b1End - 0.05 ? 'dotSeed' : 'card',
      role: 'hero',
      zIndex: 10,
      worldBox: box,
      opacity: clamp01(appear * 1.5),
      backgroundColor: lerpHexColor(brand.colors.primary, brand.colors.surface, smoothstep(0, 0.7, uM)),
      borderColor: brand.colors.primary,
      textColor: brand.colors.textPrimary,
      props: {
        glow: 1 - uM,
        eyebrow: 'BEAT 01',
        title: 'Continuous Morph',
        interiorOpacity: smoothstep(0.55, 1, uM),
      },
    });
  }

  // Beat 2: promptCard glides smoothly, emits tetherPulse at 3.85s
  if (timeSec >= b1End - 0.04 && timeSec <= b2End + 0.5) {
    const uM = windowProgress(timeSec, h1Start, h1End - h1Start);
    const box =
      timeSec < h1End
        ? interpolateWorldBox(dotRestBox, promptStartBox, uM, 'soft', 0.58)
        : promptEndBox;
    const fadeTail = timeSec > b2End ? 1 - smoothstep(b2End, b2End + 0.4, timeSec) : 1;

    actors.push({
      id: 'promptCard',
      kind: 'card',
      role: 'hero',
      zIndex: 10,
      worldBox: box,
      opacity: fadeTail,
      backgroundColor: lerpHexColor(brand.colors.primary, brand.colors.surface, smoothstep(0, 0.7, uM)),
      borderColor: brand.colors.primary,
      textColor: brand.colors.textPrimary,
      fontsUsed: [brand.typography.monoFont, brand.typography.headingFont],
      props: {
        eyebrow: 'STEP 01 · CARRY',
        title: 'Expanding Stage Architecture',
        barRatio: clamp01((timeSec - 1.5) / 2.2),
        interiorOpacity: smoothstep(0.45, 0.95, uM),
      },
    });
  }

  // Tether pulse traveling smoothly from promptCard (x=220) to portalPanel (x=1280)
  if (timeSec >= 3.85 && timeSec <= b2End + 0.06) {
    const uT = windowProgress(timeSec, h2Start, h2End - h2Start);
    const box =
      timeSec < h2Start
        ? tetherOrigin
        : interpolateWorldBox(tetherOrigin, portalCardBox, uT, 'whipQuart', 0.54);

    actors.push({
      id: 'tetherBeamLine',
      kind: 'tetherBeam',
      role: 'tether',
      zIndex: 8,
      worldBox: {
        cx: 750,
        cy: 0,
        width: 1060,
        height: 10,
        borderRadius: 5,
        rotation: 0,
        scale: 1,
      },
      opacity: 0.75 * (1 - smoothstep(b2End - 0.05, b2End + 0.06, timeSec)),
      backgroundColor: brand.colors.primary,
      borderColor: brand.colors.accent,
      textColor: brand.colors.textPrimary,
      props: { angleDeg: 90 },
    });

    actors.push({
      id: 'tetherPulse',
      kind: timeSec < b2End - 0.04 ? 'tetherBeam' : 'card',
      role: 'hero',
      zIndex: 12,
      worldBox: box,
      opacity: 1,
      backgroundColor: lerpHexColor(brand.colors.primary, brand.colors.surfaceElevated, smoothstep(0.4, 1, uT)),
      borderColor: brand.colors.accent,
      textColor: brand.colors.textPrimary,
      props: { angleDeg: 90, eyebrow: 'PORTAL', title: 'Next Workspace' },
    });
  }

  // Beat 3 & 4: portalPanel receives tether, settles, then acts as portal container for pushThrough
  if (timeSec >= b2End - 0.04) {
    const uLand = windowProgress(timeSec, h2Start, h2End - h2Start);
    const box =
      timeSec < h2End
        ? interpolateWorldBox(tetherOrigin, portalCardBox, uLand, 'whipQuart', 0.54)
        : portalCardBox;

    actors.push({
      id: 'portalPanel',
      kind: 'card',
      role: timeSec < b3End ? 'hero' : 'shell',
      zIndex: 10,
      worldBox: box,
      opacity: timeSec > b3End + 0.4 ? Math.max(0.15, 1 - smoothstep(b3End + 0.4, b3End + 1.1, timeSec)) : 1,
      backgroundColor: brand.colors.surfaceElevated,
      borderColor: brand.colors.accent,
      textColor: brand.colors.textPrimary,
      fontsUsed: [brand.typography.monoFont, brand.typography.headingFont],
      props: {
        eyebrow: 'PORTAL CONTAINER',
        title: 'Zoom Inside Architecture',
        interiorOpacity: timeSec < b3End + 0.25 ? 1 : 1 - smoothstep(b3End + 0.25, b3End + 0.6, timeSec),
      },
    });
  }

  // Beat 4 interior brandResolve revealed inside portalPanel, settles cleanly before drifting
  if (timeSec >= b3End - 0.1) {
    const revealU = evaluateCurve('snappy', windowProgress(timeSec, b3End, 0.35), 0.35);
    const driftU = smoothstep(0, 1, windowProgress(timeSec, b3End + 1.15, 1.5));
    actors.push({
      id: 'brandResolve',
      kind: 'brandMark',
      role: 'hero',
      zIndex: 14,
      worldBox: {
        ...brandResolveBox,
        cx: lerp(1280, 1280 + 55, driftU),
        scale: lerp(0.55, 1.0, revealU),
      },
      opacity: smoothstep(b3End - 0.05, b3End + 0.28, timeSec),
      backgroundColor: brand.colors.surface,
      borderColor: brand.colors.primary,
      textColor: brand.colors.textPrimary,
      fontsUsed: [brand.typography.headingFont, brand.typography.bodyFont],
      props: { showWordmark: true, showTagline: true },
    });
  }

  return actors;
}

export function evaluateFilmFrame(
  beats: BeatSheet,
  brand: BrandTokens,
  continuousFrame: number
): FrameSceneState {
  return evaluateSceneWithCamera(beats, brand, continuousFrame, (t, b) =>
    computeGoodCarryActors(t, b)
  );
}
