import { clamp01, evaluateCurve, lerp } from './easing.ts';
import type { BeatDef, CarryMode, CurvePreset, HandoffSpec, ScreenBox, WorldBox } from './types.ts';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.slice(0, 6);
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Smooth color interpolation between two hex colors across a handoff window.
 */
export function lerpHexColor(hexA: string, hexB: string, uRaw: number): string {
  const u = clamp01(uRaw);
  if (u <= 0) return hexA;
  if (u >= 1) return hexB;
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return rgbToHex(lerp(r1, r2, u), lerp(g1, g2, u), lerp(b1, b2, u));
}

function lerpLogPositive(a: number, b: number, t: number): number {
  if (a <= 0 || b <= 0) return lerp(a, b, t);
  const ratio = Math.max(a / b, b / a);
  if (ratio <= 1.5) return lerp(a, b, t);
  return Math.exp(lerp(Math.log(a), Math.log(b), t));
}

export function interpolateWorldBox(
  boxA: WorldBox,
  boxB: WorldBox,
  uRaw: number,
  curve: CurvePreset = 'snappy',
  durationSec = 0.5
): WorldBox {
  const t = evaluateCurve(curve, uRaw, durationSec);
  return {
    cx: lerp(boxA.cx, boxB.cx, t),
    cy: lerp(boxA.cy, boxB.cy, t),
    width: lerpLogPositive(boxA.width, boxB.width, t),
    height: lerpLogPositive(boxA.height, boxB.height, t),
    borderRadius: lerp(boxA.borderRadius, boxB.borderRadius, t),
    rotation: lerp(boxA.rotation, boxB.rotation, t),
    scale: lerpLogPositive(boxA.scale, boxB.scale, t),
  };
}

export interface ActiveHandoffState {
  boundaryIndex: number;
  boundarySec: number;
  winStartSec: number;
  winEndSec: number;
  handoff: HandoffSpec;
  u: number;
  uEased: number;
  mode: CarryMode;
}

/**
 * Finds the active centered handoff window covering timeSec, if any.
 */
export function getActiveHandoff(
  beats: BeatDef[],
  timeSec: number
): ActiveHandoffState | null {
  for (let i = 0; i < beats.length - 1; i++) {
    const outgoing = beats[i];
    const incoming = beats[i + 1];
    if (!outgoing.handoff) continue;

    const boundarySec = incoming.start;
    const maxSafe = 0.48 * Math.min(outgoing.duration, incoming.duration);
    const win = Math.max(0.18, Math.min(outgoing.handoff.windowSec, maxSafe));
    const winStartSec = boundarySec - win * 0.5;
    const winEndSec = boundarySec + win * 0.5;

    if (timeSec >= winStartSec && timeSec <= winEndSec) {
      const u = clamp01((timeSec - winStartSec) / win);
      const uEased = evaluateCurve(outgoing.handoff.curve, u, win);
      return {
        boundaryIndex: i,
        boundarySec,
        winStartSec,
        winEndSec,
        handoff: outgoing.handoff,
        u,
        uEased,
        mode: outgoing.handoff.mode,
      };
    }
  }
  return null;
}

/**
 * Intersection over Union (IoU) of two screen-space bounding boxes.
 */
export function computeScreenBoxIoU(a: ScreenBox, b: ScreenBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const interW = Math.max(0, x2 - x1);
  const interH = Math.max(0, y2 - y1);
  const interArea = interW * interH;
  const unionArea = a.width * a.height + b.width * b.height - interArea;
  return unionArea > 1e-6 ? interArea / unionArea : 0;
}

/**
 * Velocity-compensated IoU: shifts boxA by estimated displacement before computing IoU,
 * ensuring smooth high-speed whip pans or detach flights don't trigger false IoU failures.
 */
export function computeVelocityCompensatedIoU(
  boxA: ScreenBox,
  boxB: ScreenBox,
  vxExpected: number,
  vyExpected: number
): number {
  const shiftedA: ScreenBox = {
    ...boxA,
    x: boxA.x + vxExpected,
    y: boxA.y + vyExpected,
    cx: boxA.cx + vxExpected,
    cy: boxA.cy + vyExpected,
  };
  return Math.max(computeScreenBoxIoU(boxA, boxB), computeScreenBoxIoU(shiftedA, boxB));
}
