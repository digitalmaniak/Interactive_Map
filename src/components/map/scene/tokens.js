// ODYSSEY v2 build tokens (DESIGN.md, Deliverable 1). Globe radius R = 1.
export const tokens = {
  world: { globeRadius: 1, kmPerUnit: 6371 },
  color: {
    bg: "#07090B",
    land: { low: "#1F2022", high: "#282A2D", ridge: "#3A3D41" },
    ocean: { fill: "#2D3A42", limb: "#16202A", hatch: "#5CC8E4", hatchOpacity: 0.14 },
    coast: "#8A9399", coastOpacity: 0.7,
    route: "#5CC8E4", routeCore: "#CFF4FF",
    accent: "#FF3311",
    homeAccent: "#FFA620", // home base rings and future highlight accents; never stops
    atmo: "#5CC8E4", atmoOpacity: 0.18,
  },
  hatch: { angleDeg: 35, spacingPx: { globe: 6, trip: 9 }, thicknessPx: 1, aaPx: 0.75, limbFade: 0.15 },
  beam: { heightR: { globe: 0.06, trip: 0.12 }, falloffPow: 1.6, growMs: 450 },
  glow: {
    desktop: { enabled: true, intensity: 0.9, radius: 0.55, threshold: 0.62, smoothing: 0.12 },
    phoneHigh: { enabled: true, intensity: 0.7, radius: 0.45, threshold: 0.68, smoothing: 0.12 },
    phoneLow: { enabled: false },
    emissive: { route: 1.6, accent: 2.0 },
  },
  camera: {
    keyframes: [
      { t: 0.0, fov: 35, distR: 3.2, tiltDeg: 0 },
      { t: 0.35, fov: 34, distR: 2.4, tiltDeg: 10 },
      { t: 0.7, fov: 30, distR: 1.35, tiltDeg: 32 },
      { t: 1.0, fov: 28, distR: "fit", tiltDeg: 48, screenOffsetX: -0.12 },
    ],
    open: { ms: 1600, ease: [0.65, 0, 0.35, 1], fovTiltLagMs: 120, fovTiltEase: [0.33, 1, 0.68, 1] },
    close: { ms: 1200, ease: [0.32, 0, 0.15, 1] },
    settle: { ms: 400, overshoot: 0.015 },
    idleYawDegPerSec: 0.6, idleResumeMs: 3000,
    labelFadeMs: 250,
  },
};

// Performance tiers (DESIGN.md mobile budget).
export const tiers = {
  desktop: { dpr: [1.25, 2], msaa: true, bloom: tokens.glow.desktop, globeSeg: [256, 128], maskW: 4096, labels: 24 },
  phoneHigh: { dpr: [1.25, 2], msaa: false, bloom: tokens.glow.phoneHigh, globeSeg: [128, 64], maskW: 2048, labels: 12 },
  phoneLow: { dpr: [1, 1.5], msaa: false, bloom: null, globeSeg: [96, 48], maskW: 2048, labels: 12 },
};

// Cubic bezier easing (CSS style), solved by Newton iterations.
export function bezier([x1, y1, x2, y2]) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      const d = dx(t);
      if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    return sy(Math.min(1, Math.max(0, t)));
  };
}
