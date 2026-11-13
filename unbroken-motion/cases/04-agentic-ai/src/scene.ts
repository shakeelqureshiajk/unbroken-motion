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

function computeWorkflowActors(
  timeSec: number,
  brand: BrandTokens
): RawActorSpec[] {
  const b1End = 1.3;
  const h1Start = b1End - 0.26; // 1.04s
  const h1End = b1End + 0.26;   // 1.56s

  const b2End = 5.1;
  const h2Start = b2End - 0.26; // 4.84s
  const h2End = b2End + 0.26;   // 5.36s

  const b3End = 6.3;
  const h3Start = b3End - 0.29; // 6.01s
  const h3End = b3End + 0.29;   // 6.59s

  const b4End = 10.5;
  const h4Start = b4End - 0.31; // 10.19s
  const h4End = b4End + 0.31;   // 10.81s

  const stage2X = 960;

  const rowBox: WorldBox = {
    cx: 0,
    cy: -48,
    width: 640,
    height: 64,
    borderRadius: brand.geometry.radiusSm,
    rotation: 0,
    scale: 1,
  };

  const chipDockedBox: WorldBox = {
    cx: -210,
    cy: 0,
    width: 240,
    height: 50,
    borderRadius: 14,
    rotation: 0,
    scale: 1,
  };

  const commandBox: WorldBox = {
    cx: 0,
    cy: 0,
    width: 860,
    height: 82,
    borderRadius: brand.geometry.radiusMd,
    rotation: 0,
    scale: 1,
  };

  const previewBox: WorldBox = {
    cx: stage2X,
    cy: 0,
    width: 840,
    height: 500,
    borderRadius: brand.geometry.radiusLg,
    rotation: 0,
    scale: 1,
  };

  const dashBox: WorldBox = {
    cx: stage2X,
    cy: 0,
    width: 1180,
    height: 650,
    borderRadius: brand.geometry.radiusLg,
    rotation: 0,
    scale: 1,
  };

  const markBox: WorldBox = {
    cx: stage2X,
    cy: 0,
    width: 520,
    height: 180,
    borderRadius: brand.geometry.radiusLg,
    rotation: 0,
    scale: 1,
  };

  const actors: RawActorSpec[] = [];

  // Beat 1: Layer-1 workspaceWin + secondary menu rows fade away cleanly as rowDeploy detaches
  if (timeSec <= h1End + 0.1) {
    const winAppear = evaluateCurve('snappy', windowProgress(timeSec, 0.0, 0.42), 0.42);
    const winFadeOut = timeSec > h1Start ? 1 - smoothstep(h1Start, h1End, timeSec) : 1;
    actors.push({
      id: 'workspaceWin',
      kind: 'appWindow',
      role: 'shell',
      zIndex: 5,
      worldBox: {
        cx: 0,
        cy: 18,
        width: 820,
        height: 490,
        borderRadius: brand.geometry.radiusLg,
        rotation: 0,
        scale: lerp(0.76, 1.0, winAppear),
      },
      opacity: smoothstep(0, 0.25, timeSec) * winFadeOut,
      backgroundColor: brand.colors.surface,
      borderColor: brand.colors.border,
      props: {
        title: 'AI Agent',
        subtitle: 'Give it a goal, not step-by-step orders',
        activeTab: 'Goal',
        showSkeleton: false,
        interiorOpacity: winFadeOut,
      },
    });

    const auxExit = timeSec > 0.98 ? 1 - smoothstep(0.98, 1.24, timeSec) : 1;
    actors.push({
      id: 'rowAudit',
      kind: 'menuRow',
      role: 'context',
      zIndex: 7,
      worldBox: { cx: 0, cy: 36, width: 640, height: 64, borderRadius: brand.geometry.radiusSm, rotation: 0, scale: 1 },
      opacity: smoothstep(0.14, 0.36, timeSec) * auxExit,
      props: { label: 'Chatbot: answers one question', shortcut: 'Reply', active: false },
    });
    actors.push({
      id: 'rowShare',
      kind: 'menuRow',
      role: 'context',
      zIndex: 7,
      worldBox: { cx: 0, cy: 118, width: 640, height: 64, borderRadius: brand.geometry.radiusSm, rotation: 0, scale: 1 },
      opacity: smoothstep(0.22, 0.44, timeSec) * auxExit,
      props: { label: 'Script: follows fixed steps', shortcut: 'Rules', active: false },
    });
  }

  // rowDeploy -> detaches out of menu across [1.04, 1.56] into detachedChip inside commandBar
  if (timeSec <= b1End + 0.05) {
    const uDetach = windowProgress(timeSec, h1Start, h1End - h1Start);
    const box =
      timeSec < h1Start
        ? rowBox
        : interpolateWorldBox(rowBox, chipDockedBox, uDetach, 'soft', 0.52);
    const isClicked = timeSec >= 0.92;
    actors.push({
      id: 'rowDeploy',
      kind: 'menuRow',
      role: 'hero',
      zIndex: 12,
      worldBox: box,
      opacity: 1,
      backgroundColor: isClicked ? brand.colors.primary : brand.colors.surfaceElevated,
      borderColor: isClicked ? brand.colors.accent : brand.colors.border,
      textColor: isClicked ? brand.colors.onPrimary : brand.colors.textPrimary,
      props: {
        label: timeSec > 1.2 ? 'Lahore Trip' : 'Agent: Plan my Lahore trip',
        shortcut: 'Goal',
        active: isClicked,
        chipMode: uDetach,
      },
    });
  }

  // Cursor sweeps into rowDeploy in Beat 1 (0.40 -> 1.15) and later clicks Run in Beat 2 (4.10 -> 4.65)
  if ((timeSec >= 0.36 && timeSec <= 1.28) || (timeSec >= 4.05 && timeSec <= 4.95)) {
    const isBeat1 = timeSec <= 1.3;
    const moveU = isBeat1
      ? evaluateCurve('snappy', windowProgress(timeSec, 0.36, 0.52), 0.52)
      : evaluateCurve('snappy', windowProgress(timeSec, 4.05, 0.4), 0.4);
    const cx = isBeat1 ? lerp(280, 120, moveU) : lerp(180, 365, moveU);
    const cy = isBeat1 ? lerp(170, -32, moveU) : lerp(130, 8, moveU);
    const clickProg = isBeat1
      ? windowProgress(timeSec, 0.92, 0.28)
      : windowProgress(timeSec, 4.45, 0.28);
    const cOp = isBeat1
      ? Math.min(smoothstep(0.36, 0.5, timeSec), 1 - smoothstep(1.12, 1.28, timeSec))
      : Math.min(smoothstep(4.05, 4.2, timeSec), 1 - smoothstep(4.78, 4.95, timeSec));

    // Adjust Beat 2 cursor arrival to follow commandBar drift (+150, -24)
    const adjCx = isBeat1 ? cx : lerp(240, 515, moveU);
    const adjCy = isBeat1 ? cy : lerp(120, -16, moveU);

    actors.push({
      id: 'cursor',
      kind: 'cursor',
      role: 'context',
      zIndex: 20,
      worldBox: { cx: adjCx, cy: adjCy, width: 36, height: 36, borderRadius: 0, rotation: 0, scale: 1 },
      opacity: cOp,
      props: { clickRipple: clickProg > 0 && clickProg < 1 ? clickProg : 0 },
    });
  }

  // Beat 2: commandBar rises behind the docked detachedChip, glides smoothly during typing, holds before click & tether
  if (timeSec >= h1Start && timeSec <= h2End + 0.25) {
    const uDetach = windowProgress(timeSec, h1Start, h1End - h1Start);
    const barAppear = evaluateCurve('snappy', windowProgress(timeSec, b1End - 0.05, 0.45), 0.45);
    const barGlideU = smoothstep(0, 1, windowProgress(timeSec, 1.98, 2.12));
    const barDriftCx = lerp(commandBox.cx, 150, barGlideU);
    const barDriftCy = lerp(0, -24, barGlideU);
    const barFadeOut = timeSec > b2End ? 1 - smoothstep(b2End, h2End + 0.15, timeSec) : 1;
    const barOp = Math.min(smoothstep(b1End - 0.06, b1End + 0.18, timeSec), barFadeOut);

    const fullText = 'plan > search > book > verify';
    const typeProg = smoothstep(0, 1, windowProgress(timeSec, 1.95, 1.25));

    actors.push({
      id: 'commandBar',
      kind: 'commandBar',
      role: 'hero',
      zIndex: 9,
      worldBox: {
        ...commandBox,
        cx: barDriftCx,
        cy: barDriftCy,
        scale: timeSec < 1.75 ? lerp(0.88, 1.0, barAppear) : 1.0,
      },
      opacity: barOp,
      backgroundColor: brand.colors.surface,
      borderColor: timeSec >= 4.45 ? brand.colors.primary : brand.colors.border,
      textColor: brand.colors.textPrimary,
      props: {
        promptText: fullText.slice(0, Math.floor(typeProg * fullText.length)),
        chipLabel: 'Lahore Trip',
        showCaret: timeSec > 1.75 && timeSec < 4.45,
        caretOpacity: 0.5 + 0.5 * Math.sin(timeSec * 8),
        contentOpacity: smoothstep(1.38, 1.72, timeSec),
        actionLabel: timeSec >= 4.45 ? 'Acting' : 'Run Agent',
      },
    });

    const chipFadeOut = timeSec < 1.75 ? 1 - smoothstep(1.56, 1.74, timeSec) : 0;
    const chipBox =
      timeSec < h1End
        ? interpolateWorldBox(rowBox, chipDockedBox, uDetach, 'soft', 0.52)
        : chipDockedBox;
    if (timeSec <= 1.75) {
      actors.push({
        id: 'detachedChip',
        kind: 'chip',
        role: 'hero',
        zIndex: 13,
        worldBox: chipBox,
        opacity: chipFadeOut,
        backgroundColor: lerpHexColor(brand.colors.primary, brand.colors.surfaceElevated, uDetach),
        borderColor: brand.colors.primary,
        textColor: uDetach > 0.5 ? brand.colors.primary : brand.colors.onPrimary,
        props: { label: 'Lahore Trip', highlight: true },
      });
    }
  }

  // Beat 2 -> Beat 3: Tether across [4.76, 5.50] launching cleanly from commandBar's right edge (+560, -24)
  if (timeSec >= 4.76 && timeSec <= 5.56) {
    const uTether = windowProgress(timeSec, h2Start, h2End - h2Start);
    const orbX = lerp(560, stage2X, evaluateCurve('soft', uTether, 0.52));
    const orbY = lerp(-24, 0, smoothstep(0, 1, uTether));
    const beamGrow = smoothstep(4.76, b2End, timeSec);
    const beamFade = 1 - smoothstep(b2End, 5.48, timeSec);
    const beamLeft = 540;
    const beamRight = lerp(beamLeft + 60, stage2X - 50, beamGrow);

    actors.push({
      id: 'tetherBeam',
      kind: 'tetherBeam',
      role: 'tether',
      zIndex: 7,
      worldBox: {
        cx: 0.5 * (beamLeft + beamRight),
        cy: -12,
        width: Math.max(40, beamRight - beamLeft),
        height: 10,
        borderRadius: 5,
        rotation: 0,
        scale: 1,
      },
      opacity: Math.min(1, beamGrow) * beamFade,
      props: { angleDeg: 90 },
    });

    actors.push({
      id: 'tetherOrb',
      kind: 'chip',
      role: 'tether',
      zIndex: 14,
      worldBox: {
        cx: orbX,
        cy: orbY,
        width: lerp(180, 214, Math.sin(Math.PI * clamp01(uTether))),
        height: 56,
        borderRadius: 28,
        rotation: 0,
        scale: 1,
      },
      opacity: 1 - smoothstep(5.36, 5.54, timeSec),
      backgroundColor: brand.colors.primary,
      borderColor: brand.colors.accent,
      textColor: brand.colors.onPrimary,
      props: { label: 'TOOL CALL', highlight: false },
    });
  }

  // Beat 3: previewShell settles then portals into dashShell across [6.01, 6.59]
  if (timeSec >= 4.96 && timeSec <= b3End + 0.04) {
    const enterU = evaluateCurve('snappy', windowProgress(timeSec, 5.02, 0.44), 0.44);
    const uPortal = windowProgress(timeSec, h3Start, h3End - h3Start);
    const box =
      timeSec < h3Start
        ? { ...previewBox, scale: lerp(0.86, 1.0, enterU) }
        : interpolateWorldBox(previewBox, dashBox, uPortal, 'soft', 0.58);

    actors.push({
      id: 'previewShell',
      kind: 'appWindow',
      role: 'hero',
      zIndex: 10,
      worldBox: box,
      opacity: smoothstep(4.96, 5.2, timeSec),
      backgroundColor: brand.colors.surface,
      borderColor: timeSec < h3Start ? brand.colors.primary : brand.colors.border,
      props: {
        title: 'Agent Loop',
        subtitle: 'Calls tools: search, maps, booking',
        activeTab: 'Tools',
        showSkeleton: true,
        interiorOpacity:
          timeSec < h3Start ? smoothstep(5.1, 5.45, timeSec) : 1 - smoothstep(0, 0.7, uPortal),
      },
    });
  }

  // Beat 4: dashShell + 3 KPI Cards, continuous kinetic drift inside hold, then collapses across [10.19, 10.81]
  if (timeSec >= h3Start && timeSec <= b4End + 0.04) {
    const uPortal = windowProgress(timeSec, h3Start, h3End - h3Start);
    const uCollapse = windowProgress(timeSec, h4Start, h4End - h4Start);

    const dashDriftX = -210 * Math.sin(Math.PI * smoothstep(0, 1, windowProgress(timeSec, 6.95, 2.88)));
    const dashDriftY = -28 * Math.sin(Math.PI * 2 * smoothstep(0, 1, windowProgress(timeSec, 6.95, 2.88)));
    const dashActiveBox: WorldBox = {
      ...dashBox,
      cx: stage2X + dashDriftX,
      cy: dashDriftY,
    };

    let box: WorldBox = dashActiveBox;
    let bg = brand.colors.surface;
    if (timeSec < h3End) {
      box = interpolateWorldBox(previewBox, dashBox, uPortal, 'soft', 0.58);
    } else if (timeSec >= h4Start) {
      box = interpolateWorldBox(dashBox, markBox, uCollapse, 'soft', 0.62);
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
      id: 'dashShell',
      kind: timeSec >= h4Start && uCollapse > 0.7 ? 'brandMark' : 'appWindow',
      role: 'hero',
      zIndex: 10,
      worldBox: box,
      opacity: 1,
      backgroundColor: bg,
      borderColor: timeSec >= h4Start && uCollapse > 0.5 ? brand.colors.primary : brand.colors.border,
      props:
        timeSec >= h4Start && uCollapse > 0.7
          ? { showWordmark: false, showTagline: false }
          : {
              title: 'How an AI Agent Works',
              subtitle: 'It repeats the loop until the goal is done',
              activeTab: 'Loop',
              showSkeleton: false,
              interiorOpacity: intOp,
            },
    });

    if (timeSec >= 6.75 && timeSec <= 10.15) {
      const cardExit = 1 - smoothstep(9.82, 10.15, timeSec);
      const kpis = [
        { id: 'kpiThroughput', cx: box.cx - 350, delay: 0.0, eyebrow: 'STEP 1', title: 'Perceive context', value: 'See', ratio: 0.9 },
        { id: 'kpiContinuity', cx: box.cx, delay: 0.16, eyebrow: 'STEP 2', title: 'Reason and plan', value: 'Think', ratio: 1.0 },
        { id: 'kpiLoudness', cx: box.cx + 350, delay: 0.32, eyebrow: 'STEP 3', title: 'Take action with tools', value: 'Act', ratio: 0.82 },
      ];
      for (const k of kpis) {
        const cU = evaluateCurve('snappy', windowProgress(timeSec, 6.84 + k.delay, 0.42), 0.42);
        const op = Math.min(smoothstep(6.8 + k.delay, 7.05 + k.delay, timeSec), cardExit);
        actors.push({
          id: k.id,
          kind: 'card',
          role: 'context',
          zIndex: 12,
          worldBox: {
            cx: k.cx,
            cy: box.cy + lerp(115, 48, cU),
            width: 315,
            height: 295,
            borderRadius: brand.geometry.radiusMd,
            rotation: 0,
            scale: Math.max(0.72, cU),
          },
          opacity: op,
          backgroundColor: brand.colors.surfaceElevated,
          borderColor: brand.colors.border,
          props: {
            eyebrow: k.eyebrow,
            title: k.title,
            value: k.value,
            barRatio: k.ratio * cU,
            interiorOpacity: op,
          },
        });
      }
    }
  }

  // Beat 5: finalMark carries out of collapse [10.19 .. 10.81], glides upward smoothly, then locks
  if (timeSec >= h4Start) {
    const uCollapse = windowProgress(timeSec, h4Start, h4End - h4Start);
    const resolveRise = smoothstep(0, 1, windowProgress(timeSec, 11.12, 1.12));
    const resolvedBox: WorldBox = {
      ...markBox,
      cy: lerp(0, -82, resolveRise),
    };
    const box =
      timeSec < h4End
        ? interpolateWorldBox(dashBox, markBox, uCollapse, 'soft', 0.62)
        : resolvedBox;
    const op = timeSec < b4End ? smoothstep(b4End - 0.14, b4End + 0.06, timeSec) : 1;

    actors.push({
      id: 'finalMark',
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
  return evaluateSceneWithCamera(beats, brand, continuousFrame, computeWorkflowActors);
}
