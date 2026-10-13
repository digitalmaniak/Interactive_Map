// Pure flyover sequence: legs (resolved, in leg order) -> steps the driver plays.
// Step kinds: "move" (camera to a stop, leg highlighted) and "hold" (pause at a stop).
// No three.js scene state here so scripts/check-flyover.mjs can run it in node.
import { FLYOVER } from "./flyoverTiming.js";

const stopKey = (end) => `${end.lat.toFixed(4)},${end.lon.toFixed(4)}`;

export function legDurationMs(leg, T = FLYOVER) {
  const ang = leg.a.v.angleTo(leg.b.v);
  return leg.mode === "fly" && ang > T.longFlightRad ? T.longFlightMs : T.shortLegMs;
}

export function buildFlyoverPlan(legs, { reducedMotion = false, timing = FLYOVER } = {}) {
  const T = timing;
  const ordered = [...(legs || [])].sort((x, y) => (x.sort ?? 0) - (y.sort ?? 0));
  if (!ordered.length) return { steps: [], stops: [], totalMs: 0 };
  const stops = [];
  const addStop = (end, pinId) => {
    stops.push({ index: stops.length, key: stopKey(end), lat: end.lat, lon: end.lon, v: end.v, pinId: pinId || null, label: end.label || null });
    return stops.length - 1;
  };
  const steps = [];
  const cut = T.reducedCutMs, hold = reducedMotion ? T.reducedHoldMs : T.holdMs;
  // Intro: from wherever the camera is (the trip fit) to the first stop.
  const first = ordered[0];
  let s0 = addStop(first.a, first.fromPinId);
  steps.push({ kind: "move", legIndex: -1, legId: null, stopIndex: s0, ms: reducedMotion ? cut : T.introMs, long: false });
  steps.push({ kind: "hold", legIndex: -1, legId: null, stopIndex: s0, ms: hold });
  ordered.forEach((leg, i) => {
    const long = leg.mode === "fly" && leg.a.v.angleTo(leg.b.v) > T.longFlightRad;
    const si = addStop(leg.b, leg.toPinId);
    steps.push({ kind: "move", legIndex: i, legId: leg.id, stopIndex: si, ms: reducedMotion ? cut : legDurationMs(leg, T), long });
    steps.push({ kind: "hold", legIndex: i, legId: leg.id, stopIndex: si, ms: hold });
  });
  steps.push({ kind: "end", legIndex: ordered.length - 1, legId: null, stopIndex: stops.length - 1, ms: reducedMotion ? cut : T.outroMs, long: false });
  const totalMs = steps.reduce((a, s) => a + s.ms, 0);
  return { steps, stops, legs: ordered, totalMs };
}
