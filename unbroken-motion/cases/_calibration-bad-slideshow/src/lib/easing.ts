import type { CurvePreset } from './types.ts';

export interface SpringParams {
  stiffness: number;
  damping: number;
  mass: number;
  initialVelocity?: number;
}

export interface CurveSpec {
  preset: CurvePreset;
  peakVelocityPerUnit: number;
  effectiveSettleSec: number;
  description: string;
  spring?: SpringParams;
}

export const CURVE_SPECS: Record<CurvePreset, CurveSpec> = {
  snappy: {
    preset: 'snappy',
    peakVelocityPerUnit: 2.55,
    effectiveSettleSec: 0.42,
    description: 'High-precision nearly critically damped spring for sharp UI snaps.',
    spring: { stiffness: 320, damping: 32, mass: 1, initialVelocity: 0 },
  },
  soft: {
    preset: 'soft',
    peakVelocityPerUnit: 1.55,
    effectiveSettleSec: 0.65,
    description: 'Calm slightly overdamped settle for editorial cards and subtle glides.',
    spring: { stiffness: 140, damping: 25, mass: 1, initialVelocity: 0 },
  },
  heavy: {
    preset: 'heavy',
    peakVelocityPerUnit: 1.35,
    effectiveSettleSec: 0.82,
    description: 'Authoritative high-mass motion for full window transitions and portals.',
    spring: { stiffness: 165, damping: 28, mass: 1.7, initialVelocity: 0 },
  },
  overshoot: {
    preset: 'overshoot',
    peakVelocityPerUnit: 2.35,
    effectiveSettleSec: 0.58,
    description: 'Underdamped spring with ~6% tactile rebound for chips and badges.',
    spring: { stiffness: 260, damping: 21, mass: 1, initialVelocity: 0 },
  },
  whipQuart: {
    preset: 'whipQuart',
    peakVelocityPerUnit: 3.1,
    effectiveSettleSec: 0.45,
    description: 'Asymmetric quartic S-curve peaking mid-flight for camera whip pans.',
  },
  linear: {
    preset: 'linear',
    peakVelocityPerUnit: 1.0,
    effectiveSettleSec: 1.0,
    description: 'Constant rate progression for continuous tethers or linear sweeps.',
  },
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Analytical closed-form damped harmonic spring solver (x0 = 0 -> target = 1).
 * Pure function of elapsed time tSec >= 0.
 */
export function solveSpring(tSec: number, params: SpringParams): number {
  if (tSec <= 0) return 0;

  const { stiffness: k, damping: c, mass: m, initialVelocity = 0 } = params;
  const omega0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  const x0 = -1; // displacement relative to target = 1
  const v0 = initialVelocity;

  let disp: number;
  if (zeta < 1 - 1e-4) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const A = x0;
    const B = (zeta * omega0 * x0 + v0) / omegaD;
    disp = Math.exp(-zeta * omega0 * tSec) * (A * Math.cos(omegaD * tSec) + B * Math.sin(omegaD * tSec));
  } else if (Math.abs(zeta - 1) <= 1e-4) {
    const A = x0;
    const B = v0 + omega0 * x0;
    disp = Math.exp(-omega0 * tSec) * (A + B * tSec);
  } else {
    const s = Math.sqrt(zeta * zeta - 1);
    const r1 = -omega0 * (zeta - s);
    const r2 = -omega0 * (zeta + s);
    const C2 = (v0 - r1 * x0) / (r2 - r1);
    const C1 = x0 - C2;
    disp = C1 * Math.exp(r1 * tSec) + C2 * Math.exp(r2 * tSec);
  }

  const val = 1 + disp;
  if (Math.abs(1 - val) < 1e-4 && tSec > 0.35) {
    return 1;
  }
  return val;
}

/**
 * Evaluates a named curve across normalized progress u in [0, 1].
 * Maps u cleanly across the preset's characteristic settle envelope so
 * short and long windows both distribute motion smoothly across [0, 1].
 */
export function evaluateCurve(
  preset: CurvePreset,
  uRaw: number,
  _durationSec = 0.5
): number {
  const u = clamp01(uRaw);
  if (u <= 0) return 0;
  if (u >= 1) return 1;

  if (preset === 'linear') {
    return u;
  }

  if (preset === 'whipQuart') {
    // Fast entry/exit quartic ease-in-out
    return u < 0.5
      ? 8 * u * u * u * u
      : 1 - Math.pow(-2 * u + 2, 4) / 2;
  }

  const spec = CURVE_SPECS[preset];
  const spring = spec.spring!;
  const envelopeSec = spec.effectiveSettleSec;
  const endVal = solveSpring(envelopeSec, spring);
  const raw = solveSpring(u * envelopeSec, spring);
  return endVal === 0 ? u : raw / endVal;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Normalized window progress [0, 1] inside [startSec, startSec + durationSec].
 */
export function windowProgress(
  timeSec: number,
  startSec: number,
  durationSec: number
): number {
  if (durationSec <= 0) return timeSec >= startSec ? 1 : 0;
  return clamp01((timeSec - startSec) / durationSec);
}
