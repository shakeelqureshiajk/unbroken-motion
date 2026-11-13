import {
  interpolateWorldBox,
  lerpHexColor,
} from './lib/carry.ts';
import {
  clamp01,
  evaluateCurve,
  lerp,
  smoothstep,
  windowProgress,
} from './lib/easing.ts';
import {
  evaluateSceneWithCamera,
  type RawActorSpec,
} from './lib/sceneHelpers.ts';
import type {
  BeatSheet,
  BrandTokens,
  FrameSceneState,
  WorldBox,
} from './lib/types.ts';

function computeSmokeActors(
  timeSec: number,
  brand: BrandTokens
): RawActorSpec[] {
  const b1End = 1.1;
  const h1Start = b1End - 0.27; // 0.83s
  const h1End = b1End + 0.27;   // 1.37s

  const b2End = 4.2;
  const h2Start = b2End - 0.27; // 3.93s
  const h2End = b2End + 0.27;   // 4.47s

  // Seed enters along a gentle upward arc (-260, 90) -> (-90, -10)
  const enterU = evaluateCurve('snappy', windowProgress(timeSec, 0.0, 0.72), 0.72);
  const seedPosX = lerp(-260, -90, enterU);
  const seedPosY = lerp(90, -10, enterU) - 36 * Math.sin(Math.PI * clamp01(enterU));

  const dotRestBox: WorldBox = {
    cx: -90,
    cy: -10,
    width: 88,
    height: 88,
    borderRadius: 44,
    rotation: 0,
    scale: 1,
  };
  const barEntryBox: WorldBox = {
    cx: -60,
    cy: 12,
    width: 760,
    height: 76,
    borderRadius: brand.geometry.radiusMd,
    rotation: 0,
    scale: 1,
  };
  // Clean 0.35s settle after morph (1.37 -> 1.72s), then continuous smooth glide until 3.80s
  const barGlideU = smoothstep(0, 1, windowProgress(timeSec, 1.72, 2.08));
  const barDriftBox: WorldBox = {
    ...barEntryBox,
    cx: lerp(-60, 240, barGlideU),
    cy: lerp(12, -40, barGlideU),
  };
  const badgeBox: WorldBox = {
    cx: 240,
    cy: 0,
    width: 390,
    height: 82,
    borderRadius: 41,
    rotation: 0,
    scale: 1,
  };

  const actors: RawActorSpec[] = [];

  // Beat 1: seedDot -> morphs smoothly into commandBar across [0.83, 1.37]
  if (timeSec <= b1End + 0.06) {
    const appear = evaluateCurve('overshoot', windowProgress(timeSec, 0.0, 0.30), 0.30);
    const pulse = 1 + 0.06 * Math.sin(timeSec * 6.0) * (1 - smoothstep(0.55, 0.83, timeSec));
    const seedMoving: WorldBox = {
      ...dotRestBox,
      cx: timeSec < h1Start ? seedPosX : dotRestBox.cx,
      cy: timeSec < h1Start ? seedPosY : dotRestBox.cy,
      scale: Math.max(0.25, appear) * pulse,
    };

    const uMorph = windowProgress(timeSec, h1Start, h1End - h1Start);
    const box =
      timeSec < h1Start
        ? seedMoving
        : interpolateWorldBox(dotRestBox, barEntryBox, uMorph, 'soft', 0.54);
    const bg =
      timeSec < h1Start
        ? brand.colors.primary
        : lerpHexColor(brand.colors.primary, brand.colors.surface, smoothstep(0, 0.7, uMorph));

    actors.push({
      id: 'seedDot',
      kind: timeSec < b1End - 0.05 ? 'dotSeed' : 'commandBar',
      role: 'hero',
      zIndex: 10,
      worldBox: box,
      opacity: clamp01(appear * 1.6),
      backgroundColor: bg,
      borderColor: brand.colors.primary,
      textColor: brand.colors.textPrimary,
      props: {
        glow: 1 - uMorph,
        contentOpacity: smoothstep(0.55, 1, uMorph),
        promptText: '',
        showCaret: false,
      },
    });
  }

  // Beat 2: commandBar active from boundary 1 until boundary 2
  if (timeSec >= b1End - 0.04 && timeSec <= b2End + 0.05) {
    const uMorphIn = windowProgress(timeSec, h1Start, h1End - h1Start);
    const uCollapseOut = windowProgress(timeSec, h2Start, h2End - h2Start);

    let box = barDriftBox;
    let bg = brand.colors.surface;
    let borderCol = brand.colors.border;
    let contentOpacity = smoothstep(0.45, 1, uMorphIn);

    if (timeSec < h1End) {
      box = interpolateWorldBox(dotRestBox, barEntryBox, uMorphIn, 'soft', 0.54);
      bg = lerpHexColor(brand.colors.primary, brand.colors.surface, smoothstep(0, 0.7, uMorphIn));
      borderCol = lerpHexColor(brand.colors.primary, brand.colors.border, uMorphIn);
    } else if (timeSec > h2Start) {
      box = interpolateWorldBox(barDriftBox, badgeBox, uCollapseOut, 'heavy', 0.55);
      bg = lerpHexColor(brand.colors.surface, brand.colors.surfaceElevated, uCollapseOut);
      borderCol = lerpHexColor(brand.colors.border, brand.colors.accent, uCollapseOut);
      contentOpacity = 1 - smoothstep(0, 0.5, uCollapseOut);
    }

    const fullText = 'Deploy continuous launch film';
    const typeProgress = windowProgress(timeSec, 1.45, 1.25);
    const charCount = Math.round(fullText.length * typeProgress);
    const caretBlink = Math.sin(timeSec * 8) > 0 ? 1 : 0.25;

    actors.push({
      id: 'commandBar',
      kind: 'commandBar',
      role: 'hero',
      zIndex: 10,
      worldBox: box,
      opacity: 1,
      backgroundColor: bg,
      borderColor: borderCol,
      textColor: brand.colors.textPrimary,
      fontsUsed: [brand.typography.bodyFont, brand.typography.monoFont],
      props: {
        promptText: fullText.slice(0, charCount),
        chipLabel: timeSec > 2.45 ? '100% CARRY' : null,
        actionLabel: 'Render',
        showCaret: timeSec < 3.6,
        caretOpacity: caretBlink,
        contentOpacity,
      },
    });
  }

  // Beat 3: statusBadge resolves cleanly
  if (timeSec >= b2End - 0.04) {
    const uCollapse = windowProgress(timeSec, h2Start, h2End - h2Start);
    const box =
      timeSec < h2End
        ? interpolateWorldBox(barDriftBox, badgeBox, uCollapse, 'heavy', 0.55)
        : badgeBox;

    actors.push({
      id: 'statusBadge',
      kind: 'metricBadge',
      role: 'hero',
      zIndex: 12,
      worldBox: box,
      opacity: 1,
      backgroundColor: brand.colors.surfaceElevated,
      borderColor: brand.colors.accent,
      textColor: brand.colors.textPrimary,
      fontsUsed: [brand.typography.monoFont, brand.typography.headingFont],
      props: {
        label: 'CONTINUITY',
        value: '1.00 PASS',
        contentOpacity: lerp(0.5, 1, smoothstep(0.45, 0.9, uCollapse)),
      },
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
    computeSmokeActors(t, b)
  );
}
