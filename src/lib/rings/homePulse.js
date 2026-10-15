// Home ring pulse (Prism spec): each ring grows for 3.6s, three rings start 1.2s apart,
// so the loop is seamless. Size eases out; opacity rises 0 to 60% over the first 10%
// of growth, then fades linearly to 0.
export const PULSE = { growMs: 3600, staggerMs: 1200, count: 3, peak: 0.6, rise: 0.1 };

export function ringPhase(nowMs, i, p = PULSE) {
  return (((nowMs - i * p.staggerMs) % p.growMs) + p.growMs) % p.growMs / p.growMs;
}
export const easeOut = (x) => 1 - (1 - x) * (1 - x);
export function ringOpacity(ph, p = PULSE) {
  if (ph < p.rise) return p.peak * (ph / p.rise);
  return p.peak * Math.max(0, 1 - (ph - p.rise) / (1 - p.rise));
}
