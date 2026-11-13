import type { Resolution } from './types.ts';

export const MOTION_BLUR_SPEED_THRESHOLD = 20.0; // normalized px/frame @ 1080p30

/**
 * Normalizes instantaneous screen-space pixel/frame velocity to 1080p @ 30fps baseline
 * so Gate G3 & G5 thresholds remain consistent across 9:16, 1:1, 1080p30, and 4K60.
 */
export function normalizeSpeed1080p30(
  pxPerFrame: number,
  resolution: Resolution,
  fps: number
): number {
  const maxDim = Math.max(resolution.width, resolution.height);
  const resFactor = 1920 / Math.max(1, maxDim);
  const fpsFactor = fps / 30;
  return pxPerFrame * resFactor * fpsFactor;
}

export interface BlurMetrics {
  vx: number;
  vy: number;
  speedPxPerFrame: number;
  speedNorm: number;
  blurEnabled: boolean;
  blurStrength: number;
  blurAngleDeg: number;
}

export function computeBlurParams(
  vxScreen: number,
  vyScreen: number,
  resolution: Resolution,
  fps: number
): BlurMetrics {
  const speedPxPerFrame = Math.hypot(vxScreen, vyScreen);
  const speedNorm = normalizeSpeed1080p30(speedPxPerFrame, resolution, fps);
  const blurEnabled = speedNorm > MOTION_BLUR_SPEED_THRESHOLD;
  const excess = Math.max(0, speedNorm - MOTION_BLUR_SPEED_THRESHOLD);
  const blurStrength = blurEnabled ? Math.min(28, 2 + excess * 0.38) : 0;
  const blurAngleDeg = (Math.atan2(vyScreen, vxScreen) * 180) / Math.PI;

  return {
    vx: vxScreen,
    vy: vyScreen,
    speedPxPerFrame,
    speedNorm,
    blurEnabled,
    blurStrength,
    blurAngleDeg,
  };
}
