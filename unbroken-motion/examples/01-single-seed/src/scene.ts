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

function computeSingleSeedActors(
  timeSec: number,
  brand: BrandTokens
): RawActorSpec[] {
  // Boundary timestamps matching beats.json
  const b1End = 1.2;
  const h1Start = b1End - 0.28; // 0.92s
  const h1End = b1End + 0.28;   // 1.48s

  const b2End = 4.8;
  const h2Start = b2End - 0.27; // 4.53s
  const h2End = b2End + 0.27;   // 5.07s

  const b3End = 6.2;
  const h3Start = b3End - 0.30; // 5.90s
  const h3End = b3End + 0.30;   // 6.50s

  const b4End = 10.3;
  const h4Start = b4End - 0.31; // 9.99s
  const h4End = b4End + 0.31;   // 10.61s

  const seedRest: WorldBox = {
    cx: -140,
    cy: 0,
    width: 84,
    height: 84,
    borderRadius: 42,
    rotation: 0,
    scale: 1,
  };

  const promptBox: WorldBox = {
    cx: -80,
    cy: 0,
    width: 760,
    height: 76,
    borderRadius: brand.geometry.radiusMd,
    rotation: 0,
    scale: 1,
  };

  const canvasPosX = 820;
  const canvasBox: WorldBox = {
    cx: canvasPosX,
    cy: 0,
    width: 820,
    height: 490,
    borderRadius: brand.geometry.radiusLg,
    rotation: 0,
    scale: 1,
  };

  const deckBox: WorldBox = {
    cx: canvasPosX,
    cy: 0,
    width: 1160,
    height: 640,
    borderRadius: brand.geometry.radiusLg,
    rotation: 0,
    scale: 1,
  };

  const markBox: WorldBox = {
    cx: canvasPosX,
    cy: 0,
    width: 520,
    height: 180,
    borderRadius: brand.geometry.radiusLg,
    rotation: 0,
    scale: 1,
  };

  const actors: RawActorSpec[] = [];

  // Beat 1: seedDot rises gently then morphs smoothly into promptBar across [0.92, 1.48]
  if (timeSec <= b1End + 0.05) {
    const enterU = evaluateCurve('snappy', windowProgress(timeSec, 0.0, 0.58), 0.58);
    const seedMoving: WorldBox = {
      ...seedRest,
      cx: lerp(-320, seedRest.cx, enterU),
      cy: lerp(80, seedRest.cy, enterU) - 32 * Math.sin(Math.PI * clamp01(enterU)),
      scale: Math.max(0.28, evaluateCurve('overshoot', windowProgress(timeSec, 0.0, 0.30), 0.30)),
    };
    const uMorph = windowProgress(timeSec, h1Start, h1End - h1Start);
    const box =
      timeSec < h1Start
        ? seedMoving
        : interpolateWorldBox(seedRest, promptBox, uMorph, 'soft', 0.56);
    const bg =
      timeSec < h1Start
        ? brand.colors.primary
        : lerpHexColor(brand.colors.primary, brand.colors.surface, smoothstep(0.15, 0.85, uMorph));

    actors.push({
      id: 'seedDot',
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
          ? { glow: 1.1 }
          : {
              promptText: '',
              showCaret: false,
              contentOpacity: smoothstep(0.55, 1, uMorph),
              actionLabel: 'Build',
            },
    });
  }

  // Beat 2: promptBar owns the stage after h1Start, types query, reveals intentChip, glides dynamically to keep rhythm crisp, then fires tetherOrb
  if (timeSec >= h1Start && timeSec <= h2End + 0.25) {
    const uMorph = windowProgress(timeSec, h1Start, h1End - h1Start);
    // Crisp post-morph settle [1.48..1.90] (13f), smooth kinetic glide [1.90..4.08] (~115 px/s), read hold [4.08..4.53] (13f)
    const barGlideU = smoothstep(0, 1, windowProgress(timeSec, 1.9, 2.18));
    const barRestPos: WorldBox = {
      ...promptBox,
      cx: lerp(promptBox.cx, 180, barGlideU),
      cy: lerp(0, -34, barGlideU),
    };
    const box =
      timeSec < h1End
        ? interpolateWorldBox(seedRest, promptBox, uMorph, 'soft', 0.56)
        : barRestPos;

    const fullPrompt = 'Compile unified motion graph';
    const typeProg = smoothstep(0, 1, windowProgress(timeSec, 1.92, 1.15));
    const charCount = Math.floor(typeProg * fullPrompt.length);
    const promptFadeOut = timeSec > b2End ? 1 - smoothstep(b2End, h2End + 0.15, timeSec) : 1;

    actors.push({
      id: 'promptBar',
      kind: 'commandBar',
      role: 'hero',
      zIndex: 9,
      worldBox: box,
      opacity: promptFadeOut,
      backgroundColor: lerpHexColor(
        brand.colors.primary,
        brand.colors.surface,
        smoothstep(0.15, 0.85, timeSec < h1End ? uMorph : 1)
      ),
      borderColor: brand.colors.border,
      textColor: brand.colors.textPrimary,
      props: {
        promptText: fullPrompt.slice(0, charCount),
        chipLabel: timeSec >= 2.9 ? 'UNBROKEN' : undefined,
        showCaret: timeSec > h1End && timeSec < b2End,
        caretOpacity: timeSec > 3.15 ? 0.5 + 0.5 * Math.sin(timeSec * 8) : 1,
        contentOpacity: timeSec < h1End ? smoothstep(0.55, 1, uMorph) : 1,
        actionLabel: timeSec >= 2.95 ? 'Execute' : 'Build',
      },
    });

    if (timeSec >= 2.9 && timeSec < b2End) {
      const chipAppear = evaluateCurve('overshoot', windowProgress(timeSec, 2.9, 0.35), 0.35);
      actors.push({
        id: 'intentChip',
        kind: 'chip',
        role: 'context',
        zIndex: 8,
        worldBox: {
          cx: barRestPos.cx,
          cy: barRestPos.cy + 78,
          width: 310,
          height: 44,
          borderRadius: 22,
          rotation: 0,
          scale: Math.max(0.4, chipAppear),
        },
        opacity: smoothstep(2.9, 3.1, timeSec),
        props: { label: 'Carry mode: TETHER', highlight: true },
      });
    }
  }

  // Beat 2 -> Beat 3 TETHER BEAM & TETHER ORB across [4.45, 5.18]
  if (timeSec >= 4.45 && timeSec <= 5.3) {
    const uTether = windowProgress(timeSec, h2Start, h2End - h2Start);
    const orbX = lerp(380, canvasPosX, evaluateCurve('soft', uTether, 0.54));
    const orbY = lerp(-18, 0, smoothstep(0, 1, uTether));
    const orbRadius = lerp(26, 36, Math.sin(Math.PI * clamp01(uTether)));

    const beamGrow = smoothstep(4.45, b2End, timeSec);
    const beamFade = 1 - smoothstep(b2End, 5.25, timeSec);
    const beamLeft = 360;
    const beamRight = lerp(beamLeft + 60, canvasPosX - 60, beamGrow);

    actors.push({
      id: 'tetherBeam',
      kind: 'tetherBeam',
      role: 'tether',
      zIndex: 7,
      worldBox: {
        cx: 0.5 * (beamLeft + beamRight),
        cy: -9,
        width: Math.max(40, beamRight - beamLeft),
        height: 10,
        borderRadius: 5,
        rotation: 0,
        scale: 1,
      },
      opacity: Math.min(1, beamGrow) * beamFade,
      props: { angleDeg: 90 },
    });

    const dockFade = 1 - smoothstep(5.07, 5.28, timeSec);
    actors.push({
      id: 'tetherOrb',
      kind: 'chip',
      role: 'tether',
      zIndex: 14,
      worldBox: {
        cx: orbX,
        cy: orbY,
        width: lerp(180, 210, Math.sin(Math.PI * clamp01(uTether))),
        height: lerp(56, 72, orbRadius / 36 - 0.5),
        borderRadius: 28,
        rotation: 0,
        scale: 1,
      },
      opacity: dockFade,
      backgroundColor: brand.colors.primary,
      borderColor: brand.colors.accent,
      textColor: brand.colors.onPrimary,
      props: { label: 'TOKEN PACKET', highlight: false },
    });
  }

  // Beat 3: canvasShell receives whip + tether, rests, then portals into architectureDeck across [5.90, 6.50]
  if (timeSec >= 4.68 && timeSec <= b3End + 0.04) {
    const enterU = evaluateCurve('snappy', windowProgress(timeSec, 4.72, 0.44), 0.44);
    const uPortal = windowProgress(timeSec, h3Start, h3End - h3Start);
    const canvasIdle: WorldBox = {
      ...canvasBox,
      scale: lerp(0.86, 1.0, enterU),
    };
    const box =
      timeSec < h3Start
        ? canvasIdle
        : interpolateWorldBox(canvasBox, deckBox, uPortal, 'soft', 0.6);

    actors.push({
      id: 'canvasShell',
      kind: 'appWindow',
      role: 'hero',
      zIndex: 10,
      worldBox: box,
      opacity: smoothstep(4.68, 4.92, timeSec),
      backgroundColor: brand.colors.surface,
      borderColor:
        timeSec < h3Start ? brand.colors.primary : brand.colors.border,
      props: {
        title: 'Motion Graph Stage',
        subtitle: 'Vector shell active — continuous camera solve',
        activeTab: 'Pipeline',
        showSkeleton: true,
        interiorOpacity: timeSec < h3Start ? smoothstep(4.85, 5.25, timeSec) : 1 - smoothstep(0, 0.7, uPortal),
      },
    });
  }

  // Beat 4: architectureDeck expands out of portal [5.90..6.50], displays 3 semantic cards, tracks smoothly, then collapses into brandMark [9.99..10.61]
  if (timeSec >= h3Start && timeSec <= b4End + 0.04) {
    const uPortal = windowProgress(timeSec, h3Start, h3End - h3Start);
    const uCollapse = windowProgress(timeSec, h4Start, h4End - h4Start);

    // Subtle lateral presentation pan inside [6.96..9.56] (~110 px/s peak) with crisp entry/exit rests
    const deckDriftX = -150 * Math.sin(Math.PI * smoothstep(0, 1, windowProgress(timeSec, 6.96, 2.6)));
    const deckActiveBox: WorldBox = {
      ...deckBox,
      cx: canvasPosX + deckDriftX,
    };
    const markTargetBox: WorldBox = markBox;

    let box: WorldBox = deckActiveBox;
    let bg = brand.colors.surface;
    if (timeSec < h3End) {
      box = interpolateWorldBox(canvasBox, deckBox, uPortal, 'soft', 0.6);
    } else if (timeSec >= h4Start) {
      box = interpolateWorldBox(deckBox, markTargetBox, uCollapse, 'soft', 0.62);
      bg = lerpHexColor(
        brand.colors.surface,
        brand.colors.surfaceElevated,
        smoothstep(0.15, 0.85, uCollapse)
      );
    }

    const interiorOp =
      timeSec < h3End
        ? smoothstep(0.3, 0.95, uPortal)
        : timeSec >= h4Start
          ? 1 - smoothstep(0, 0.65, uCollapse)
          : 1;

    actors.push({
      id: 'architectureDeck',
      kind: timeSec >= h4Start && uCollapse > 0.7 ? 'brandMark' : 'appWindow',
      role: 'hero',
      zIndex: 10,
      worldBox: box,
      opacity: 1,
      backgroundColor: bg,
      borderColor:
        timeSec >= h4Start && uCollapse > 0.5 ? brand.colors.primary : brand.colors.border,
      props:
        timeSec >= h4Start && uCollapse > 0.7
          ? { showWordmark: false, showTagline: false }
          : {
              title: 'Unbroken Runtime',
              subtitle: 'Zero dead cuts across 5 camera beats',
              activeTab: 'Live Telemetry',
              showSkeleton: false,
              interiorOpacity: interiorOp,
            },
    });

    // Nested dashboard metric cards dwell cleanly inside [6.65 .. 9.85]
    if (timeSec >= 6.65 && timeSec <= 9.95) {
      const cardExit = 1 - smoothstep(9.65, 9.95, timeSec);
      const specs = [
        { id: 'cardLatency', cx: box.cx - 340, delay: 0.0, eyebrow: 'HANDOFF', title: 'IoU Continuity', value: '0.88+', ratio: 0.92 },
        { id: 'cardCarry', cx: box.cx, delay: 0.16, eyebrow: 'RHYTHM', title: 'Post Settle', value: '14f', ratio: 0.84 },
        { id: 'cardAudio', cx: box.cx + 340, delay: 0.32, eyebrow: 'AUDIO', title: 'Loudness', value: '-14.0', ratio: 0.78 },
      ];
      for (const sp of specs) {
        const cU = evaluateCurve(
          'snappy',
          windowProgress(timeSec, 6.75 + sp.delay, 0.42),
          0.42
        );
        const op = Math.min(smoothstep(6.72 + sp.delay, 6.95 + sp.delay, timeSec), cardExit);
        actors.push({
          id: sp.id,
          kind: 'card',
          role: 'context',
          zIndex: 12,
          worldBox: {
            cx: sp.cx,
            cy: lerp(110, 48, cU),
            width: 310,
            height: 290,
            borderRadius: brand.geometry.radiusMd,
            rotation: 0,
            scale: Math.max(0.72, cU),
          },
          opacity: op,
          backgroundColor: brand.colors.surfaceElevated,
          borderColor: brand.colors.border,
          props: {
            eyebrow: sp.eyebrow,
            title: sp.title,
            value: sp.value,
            barRatio: sp.ratio * cU,
            interiorOpacity: op,
          },
        });
      }
    }
  }

  // Beat 5: brandMark takes the carry out of collapse [9.99 .. 10.61], elevates smoothly, and locks at rest
  if (timeSec >= h4Start) {
    const uCollapse = windowProgress(timeSec, h4Start, h4End - h4Start);
    const resolveRise = smoothstep(0, 1, windowProgress(timeSec, 11.02, 0.88));
    const resolvedBox: WorldBox = {
      ...markBox,
      cy: lerp(0, -64, resolveRise),
    };
    const box =
      timeSec < h4End
        ? interpolateWorldBox(deckBox, markBox, uCollapse, 'soft', 0.62)
        : resolvedBox;
    const op = timeSec < b4End ? smoothstep(b4End - 0.14, b4End + 0.06, timeSec) : 1;

    actors.push({
      id: 'brandMark',
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
  return evaluateSceneWithCamera(beats, brand, continuousFrame, computeSingleSeedActors);
}
