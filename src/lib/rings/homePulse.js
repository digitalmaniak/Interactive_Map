// Home ring pulse (Prism): one slow pulse every 3 s. Returns 0..1, a smooth swell that
// peaks at mid-cycle and rests near 0 the rest of the time. Reduced motion never calls it.
export const PULSE_MS = 3000;
export function homeRingPulse(nowMs, periodMs = PULSE_MS) {
  const ph = ((nowMs % periodMs) + periodMs) % periodMs / periodMs;
  const s = Math.sin(Math.PI * ph);
  return s * s * s * s;
}
