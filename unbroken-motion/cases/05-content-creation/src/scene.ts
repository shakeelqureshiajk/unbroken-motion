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

function computeVerticalReelActors(
  timeSec: number,
  brand: BrandTokens
): RawActorSpec[] {
  const b1End = 1.2;
  const h1Start = b1End - 0.28; // 0.92s
  const h1End = b1End + 0.28;   // 1.48s

  const b2End = 4.7;
  const h2Start = b2End - 0.26; // 4.44s
  const h2End = b2End + 0.26;   // 4.96s

  const b3End = 6.0;
  const h3Start = b3End - 0.29; // 5.71s
  const h3End = b3End + 0.29;   // 6.29s

  const b4End = 10.1;
  const h4Start = b4End - 0.31; // 9.79s
  const h4End = b4End + 0.31;   // 10.41s

  const stage2Y = 700;

  const seedRest: WorldBox = {
    cx: 0,
    cy: -40,
    width: 96,
    height: 96,
    borderRadius: 48,
    rotation: 0,
    scale: 1,
  };

  const storyBox: WorldBox = {
    cx: 0,
    cy: 0,
    width: 660,
    height: 92,
    borderRadius: brand.geometry.radiusLg,
    rotation: 0,
    scale: 1,
  };

  const phoneBox: WorldBox = {
    cx: 0,
    cy: stage2Y,
    width: 560,
    height: 860,
    borderRadius: 44,
    rotation: 0,
    scale: 1,
  };

  const canvasBox: WorldBox = {
    cx: 0,
    cy: stage2Y,
    width: 840,
    height: 1260,
    borderRadius: brand.geometry.radiusLg,
    rotation: 0,
    scale: 1,
  };

  const markBox: WorldBox = {
    cx: 0,
    cy: stage2Y,
    width: 580,
    height: 240,
    borderRadius: brand.geometry.radiusLg,
    rotation: 0,
    scale: 1,
  };

  const actors: RawActorSpec[] = [];

  // Beat 1: terracottaSeed floats smoothly up, then morphs into warm storyBar
  if (timeSec <= b1End + 0.05) {
    const enterU = evaluateCurve('soft', windowProgress(timeSec, 0.0, 0.56), 0.56);
    const seedMoving: WorldBox = {
      ...seedRest,
      cx: lerp(-120, seedRest.cx, enterU),
      cy: lerp(180, seedRest.cy, enterU),
      scale: Math.max(0.32, evaluateCurve('overshoot', windowProgress(timeSec, 0.0, 0.32), 0.32)),
    };
    const uMorph = windowProgress(timeSec, h1Start, h1End - h1Start);
    const box =
      timeSec < h1Start
        ? seedMoving
        : interpolateWorldBox(seedRest, storyBox, uMorph, 'soft', 0.56);
    const bg =
      timeSec < h1Start
        ? brand.colors.primary
        : lerpHexColor(brand.colors.primary, brand.colors.surface, smoothstep(0.15, 0.85, uMorph));

    actors.push({
      id: 'terracottaSeed',
      kind: timeSec < h1Start ? 'dotSeed' : 'commandBar',
      role: 'hero',
      zIndex: 10,
      worldBox: box,
      opacity: 1,
      backgroundColor: bg,
      borderColor: timeSec < h1Start ? brand.colors.accent : brand.colors.border,
      textColor: brand.colors.textPrimary,
      props:
        timeSec < h1Start
          ? { glow: 0.9 }
          : { promptText: '', showCaret: false, contentOpacity: smoothstep(0.55, 1, uMorph), actionLabel: 'Open' },
    });
  }

  // Beat 2: storyBar settles, drifts gracefully upward vertically across [1.85..3.95], holds, and fires vertical tetherOrb downward
  if (timeSec >= h1Start && timeSec <= h2End + 0.25) {
    const uMorph = windowProgress(timeSec, h1Start, h1End - h1Start);
    const glideU = smoothstep(0, 1, windowProgress(timeSec, 1.85, 2.08));
    const storyActive: WorldBox = {
      ...storyBox,
      cy: lerp(0, 160, glideU),
    };
    const box =
      timeSec < h1End
        ? interpolateWorldBox(seedRest, storyBox, uMorph, 'soft', 0.56)
        : storyActive;

    const fullText = 'Turn one idea into a story';
    const typeProg = smoothstep(0, 1, windowProgress(timeSec, 1.85, 1.15));
    const fadeOut = timeSec > b2End ? 1 - smoothstep(b2End, h2End + 0.15, timeSec) : 1;

    actors.push({
      id: 'storyBar',
      kind: 'commandBar',
      role: 'hero',
      zIndex: 9,
      worldBox: box,
      opacity: fadeOut,
      backgroundColor: lerpHexColor(
        brand.colors.primary,
        brand.colors.surface,
        smoothstep(0.15, 0.85, timeSec < h1End ? uMorph : 1)
      ),
      borderColor: brand.colors.border,
      textColor: brand.colors.textPrimary,
      props: {
        promptText: fullText.slice(0, Math.floor(typeProg * fullText.length)),
        chipLabel: timeSec >= 2.85 ? 'IDEA' : undefined,
        showCaret: timeSec > h1End && timeSec < b2End,
        caretOpacity: 0.5 + 0.5 * Math.sin(timeSec * 8),
        contentOpacity: timeSec < h1End ? smoothstep(0.55, 1, uMorph) : 1,
        actionLabel: 'Publish',
      },
    });

    if (timeSec >= 2.85 && timeSec < b2End) {
      const chipU = evaluateCurve('overshoot', windowProgress(timeSec, 2.85, 0.35), 0.35);
      actors.push({
        id: 'editionBadge',
        kind: 'chip',
        role: 'context',
        zIndex: 8,
        worldBox: {
          cx: 0,
          cy: box.cy + 94,
          width: 310,
          height: 50,
          borderRadius: 25,
          rotation: 0,
          scale: Math.max(0.45, chipU),
        },
        opacity: smoothstep(2.85, 3.05, timeSec),
        props: { label: 'NEW VIDEO IDEA', highlight: true },
      });
    }
  }

  // Beat 2 -> Beat 3: Vertical Tether Beam & Orb traveling downward [4.36 .. 5.14]
  if (timeSec >= 4.36 && timeSec <= 5.2) {
    const uTether = windowProgress(timeSec, h2Start, h2End - h2Start);
    const orbY = lerp(240, stage2Y, evaluateCurve('soft', uTether, 0.52));
    const beamGrow = smoothstep(4.36, b2End, timeSec);
    const beamFade = 1 - smoothstep(b2End, 5.14, timeSec);
    const beamTop = 220;
    const beamBot = lerp(beamTop + 60, stage2Y - 50, beamGrow);

    actors.push({
      id: 'tetherBeam',
      kind: 'tetherBeam',
      role: 'tether',
      zIndex: 7,
      worldBox: {
        cx: 0,
        cy: 0.5 * (beamTop + beamBot),
        width: 12,
        height: Math.max(40, beamBot - beamTop),
        borderRadius: 6,
        rotation: 0,
        scale: 1,
      },
      opacity: Math.min(1, beamGrow) * beamFade,
      props: { angleDeg: 180 },
    });

    actors.push({
      id: 'tetherOrb',
      kind: 'chip',
      role: 'tether',
      zIndex: 14,
      worldBox: {
        cx: 0,
        cy: orbY,
        width: 170,
        height: lerp(120, 210, Math.sin(Math.PI * clamp01(uTether))),
        borderRadius: 48,
        rotation: 0,
        scale: 1,
      },
      opacity: 1 - smoothstep(4.96, 5.16, timeSec),
      backgroundColor: brand.colors.primary,
      borderColor: brand.colors.accent,
      textColor: brand.colors.onPrimary,
      props: { label: 'RECORD', highlight: false },
    });
  }

  // Beat 3: phoneShowcase settles then portals into vertical editorialCanvas [5.71 .. 6.29]
  if (timeSec >= 4.58 && timeSec <= b3End + 0.04) {
    const enterU = evaluateCurve('soft', windowProgress(timeSec, 4.62, 0.44), 0.44);
    const uPortal = windowProgress(timeSec, h3Start, h3End - h3Start);
    const box =
      timeSec < h3Start
        ? { ...phoneBox, scale: lerp(0.86, 1.0, enterU) }
        : interpolateWorldBox(phoneBox, canvasBox, uPortal, 'soft', 0.58);

    actors.push({
      id: 'phoneShowcase',
      kind: 'phoneFrame',
      role: 'hero',
      zIndex: 10,
      worldBox: box,
      opacity: smoothstep(4.58, 4.82, timeSec),
      backgroundColor: brand.colors.surfaceElevated,
      borderColor: brand.colors.primary,
      textColor: brand.colors.textPrimary,
      props: {
        title: 'REC  00:15',
        interiorOpacity:
          timeSec < h3Start ? smoothstep(4.75, 5.1, timeSec) : 1 - smoothstep(0, 0.7, uPortal),
      },
    });
  }

  // Beat 4: editorialCanvas with 3 vertically stacked cards, smooth drift, then collapses to atelierMark
  if (timeSec >= h3Start && timeSec <= b4End + 0.04) {
    const uPortal = windowProgress(timeSec, h3Start, h3End - h3Start);
    const uCollapse = windowProgress(timeSec, h4Start, h4End - h4Start);
    const canvasDriftY = -140 * Math.sin(Math.PI * smoothstep(0, 1, windowProgress(timeSec, 6.72, 2.55)));
    const canvasActive: WorldBox = {
      ...canvasBox,
      cy: stage2Y + canvasDriftY,
    };

    let box: WorldBox = canvasActive;
    let bg = brand.colors.surface;
    if (timeSec < h3End) {
      box = interpolateWorldBox(phoneBox, canvasBox, uPortal, 'soft', 0.58);
    } else if (timeSec >= h4Start) {
      box = interpolateWorldBox(canvasBox, markBox, uCollapse, 'soft', 0.62);
      bg = lerpHexColor(
        brand.colors.surface,
        brand.colors.surfaceElevated,
        smoothstep(0.15, 0.85, uCollapse)
      );
    }

    const intOp =
      timeSec < h3End
        ? smoothstep(0.3, 0.95, uPortal)
        : timeSec >= h4Start
          ? 1 - smoothstep(0, 0.65, uCollapse)
          : 1;

    actors.push({
      id: 'editorialCanvas',
      kind: timeSec >= h4Start && uCollapse > 0.7 ? 'brandMark' : 'appWindow',
      role: 'hero',
      zIndex: 10,
      worldBox: box,
      opacity: 1,
      backgroundColor: bg,
      borderColor: timeSec >= h4Start && uCollapse > 0.5 ? brand.colors.primary : brand.colors.border,
      textColor: brand.colors.textPrimary,
      props:
        timeSec >= h4Start && uCollapse > 0.7
          ? { showWordmark: false, showTagline: false }
          : {
              title: 'Content Workflow',
              subtitle: 'One idea, every platform',
              activeTab: 'Create',
              showSkeleton: false,
              interiorOpacity: intOp,
            },
    });

    if (timeSec >= 6.45 && timeSec <= 9.75) {
      const cardExit = 1 - smoothstep(9.42, 9.75, timeSec);
      const stack = [
        { id: 'editorialCardA', cyOff: -240, delay: 0.0, eyebrow: 'STEP 1', title: 'Script and record', value: 'Shoot', ratio: 0.92 },
        { id: 'editorialCardB', cyOff: 60, delay: 0.16, eyebrow: 'STEP 2', title: 'Cut, caption, music', value: 'Edit', ratio: 0.86 },
        { id: 'editorialCardC', cyOff: 360, delay: 0.32, eyebrow: 'STEP 3', title: 'Post and grow audience', value: 'Publish', ratio: 0.96 },
      ];
      for (const s of stack) {
        const cU = evaluateCurve('soft', windowProgress(timeSec, 6.52 + s.delay, 0.42), 0.42);
        const op = Math.min(smoothstep(6.48 + s.delay, 6.75 + s.delay, timeSec), cardExit);
        actors.push({
          id: s.id,
          kind: 'card',
          role: 'context',
          zIndex: 12,
          worldBox: {
            cx: box.cx,
            cy: box.cy + s.cyOff + lerp(40, 0, cU),
            width: 680,
            height: 250,
            borderRadius: brand.geometry.radiusMd,
            rotation: 0,
            scale: Math.max(0.78, cU),
          },
          opacity: op,
          backgroundColor: brand.colors.surfaceElevated,
          borderColor: brand.colors.border,
          textColor: brand.colors.textPrimary,
          props: {
            eyebrow: s.eyebrow,
            title: s.title,
            value: s.value,
            barRatio: s.ratio * cU,
            interiorOpacity: op,
          },
        });
      }
    }
  }

  // Beat 5: atelierMark emerges out of collapse [9.79 .. 10.41], drifts gently upward, then rests at 12.40s
  if (timeSec >= h4Start) {
    const uCollapse = windowProgress(timeSec, h4Start, h4End - h4Start);
    const riseU = smoothstep(0, 1, windowProgress(timeSec, 10.82, 0.88));
    const resolvedBox: WorldBox = {
      ...markBox,
      cy: lerp(stage2Y, stage2Y - 110, riseU),
    };
    const box =
      timeSec < h4End
        ? interpolateWorldBox(canvasBox, markBox, uCollapse, 'soft', 0.62)
        : resolvedBox;
    const op = timeSec < b4End ? smoothstep(b4End - 0.14, b4End + 0.06, timeSec) : 1;

    actors.push({
      id: 'atelierMark',
      kind: 'brandMark',
      role: 'hero',
      zIndex: 11,
      worldBox: box,
      opacity: op,
      backgroundColor: lerpHexColor(
        brand.colors.surface,
        brand.colors.surfaceElevated,
        timeSec < h4End ? smoothstep(0.2, 0.9, uCollapse) : 1
      ),
      borderColor: brand.colors.primary,
      textColor: brand.colors.textPrimary,
      props: {
        showWordmark: timeSec >= h4End - 0.12,
        showTagline: timeSec >= h4End + 0.1,
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
  // Timeline uniformly stretched from 12.4s to 15.0s (pure function of time).
  const TIME_SCALE = 15.0 / 12.4;
  return evaluateSceneWithCamera(beats, brand, continuousFrame, (t, b) =>
    computeVerticalReelActors(t / TIME_SCALE, b)
  );
}
