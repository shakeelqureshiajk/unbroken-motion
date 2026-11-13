/**
 * Deterministic PRNG and continuous seeded noise utilities.
 * Zero Math.random() calls allowed anywhere in unbroken-motion.
 */

export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashInt2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed | 0, 1442695041);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

function quinticFade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Deterministic smooth value-gradient noise in [-1, 1] over 1D coordinates.
 */
export function simplex1D(seed: number, x: number): number {
  return simplex2D(seed, x, 0.371);
}

/**
 * Deterministic smooth 2D noise in [-1, 1] suitable for organic camera float.
 */
export function simplex2D(seed: number, x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const u = quinticFade(fx);
  const v = quinticFade(fy);

  const n00 = hashInt2(ix, iy, seed) * 2 - 1;
  const n10 = hashInt2(ix + 1, iy, seed) * 2 - 1;
  const n01 = hashInt2(ix, iy + 1, seed) * 2 - 1;
  const n11 = hashInt2(ix + 1, iy + 1, seed) * 2 - 1;

  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
}

/**
 * 2-octave fractional Brownian motion in [-1, 1].
 */
export function fbm2D(seed: number, x: number, y: number): number {
  return 0.7 * simplex2D(seed, x, y) + 0.3 * simplex2D(seed + 101, x * 2.03, y * 2.03);
}
