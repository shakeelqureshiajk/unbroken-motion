import { windowProgress } from './lib/easing.ts';
import { evaluateSceneWithCamera, type RawActorSpec } from './lib/sceneHelpers.ts';
import type { BeatSheet, BrandTokens, FrameSceneState } from './lib/types.ts';

/**
 * Deliberately bad slideshow-style composition:
 * - Boundary 1 (b1 -> b2): cross-dissolves cardA (-420, 0) into unrelated cardB (+420, 0).
 * - Boundary 2 (b2 -> b3): tries to fake continuity via a frozen cornerLogo (anti-static cheat)
 *   while abruptly cutting cardB -> cardC and teleporting camera x: 0 -> 500.
 * - Uniform 2.0s beat durations with zero movement.
 */
function computeBadSlideshowActors(
  timeSec: number,
  brand: BrandTokens
): RawActorSpec[] {
  const actors: RawActorSpec[] = [];

  // Frozen corner watermark across entire film (anti-static cheat test)
  actors.push({
    id: 'cornerLogo',
    kind: 'metricBadge',
    role: 'context',
    zIndex: 5,
    worldBox: {
      cx: -720,
      cy: -410,
      width: 240,
      height: 54,
      borderRadius: brand.geometry.radiusSm,
      rotation: 0,
      scale: 1,
    },
    opacity: 1,
    backgroundColor: brand.colors.surface,
    borderColor: brand.colors.border,
    textColor: brand.colors.textMuted,
    props: { label: 'STATIC', value: 'LOGO' },
  });

  if (timeSec < 2.1) {
    const fadeOut = 1 - windowProgress(timeSec, 1.85, 0.25);
    actors.push({
      id: 'cardA',
      kind: 'card',
      role: 'hero',
      zIndex: 10,
      worldBox: {
        cx: -420,
        cy: 0,
        width: 460,
        height: 260,
        borderRadius: brand.geometry.radiusMd,
        rotation: 0,
        scale: 1,
      },
      opacity: fadeOut,
      backgroundColor: brand.colors.surface,
      borderColor: brand.colors.border,
      textColor: brand.colors.textPrimary,
      props: { eyebrow: 'SLIDE 1', title: 'Disconnected Card A' },
    });
  }

  if (timeSec >= 1.9 && timeSec < 4.0) {
    const fadeIn = windowProgress(timeSec, 1.9, 0.25);
    actors.push({
      id: 'cardB',
      kind: 'card',
      role: 'hero',
      zIndex: 10,
      worldBox: {
        cx: 420,
        cy: 0,
        width: 460,
        height: 260,
        borderRadius: brand.geometry.radiusMd,
        rotation: 0,
        scale: 1,
      },
      opacity: fadeIn,
      backgroundColor: brand.colors.surfaceElevated,
      borderColor: brand.colors.primary,
      textColor: brand.colors.textPrimary,
      props: { eyebrow: 'SLIDE 2', title: 'Hard Cut Card B' },
    });
  }

  if (timeSec >= 4.0) {
    actors.push({
      id: 'cardC',
      kind: 'card',
      role: 'hero',
      zIndex: 10,
      worldBox: {
        cx: 500,
        cy: 0,
        width: 520,
        height: 280,
        borderRadius: brand.geometry.radiusMd,
        rotation: 0,
        scale: 1,
      },
      opacity: 1,
      backgroundColor: brand.colors.surface,
      borderColor: brand.colors.accent,
      textColor: brand.colors.textPrimary,
      props: { eyebrow: 'SLIDE 3', title: 'Teleported Card C' },
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
    computeBadSlideshowActors(t, b)
  );
}
