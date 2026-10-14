// Share page cinematic flyover (Prism spec). Pure: legs -> steps, so check-cinematic runs in node.
// Steps: open (fade in, hold, push to first place), move (one per leg), hold (at places only),
// end (pull back to the opening view). Waypoints without a place (a border, an airport,
// home on the way out) are passed through with no hold.
export const CINE = {
  fadeMs: 800, openHoldMs: 400, pushMs: 1200, titleInMs: 600,
  legBaseMs: 1600, legPerKmMs: 0.25, legMaxMs: 4500, shortCutMs: 600, shortKm: 2,
  holdMs: 2200, orbitDeg: 6, cardInMs: 300, cardOutLeadMs: 300,
  endMs: 2000, maxTotalMs: 40000, openDistK: 3, openMaxD: 6, // share view lifts the trip cap to MAX_DIST so the 3x pull-back is full
  tiltStopDeg: 35, tiltPeakDeg: 15, peakK: 1.4, headLead: 0.08,
  reducedCutMs: 180,
};
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
const R_KM = 6371;
const kmOf = (leg) => (Number.isFinite(Number(leg.distanceKm)) && leg.distanceKm != null ? Number(leg.distanceKm) : leg.a.v.angleTo(leg.b.v) * R_KM);

export function cineLegMs(km, C = CINE) {
  if (km < C.shortKm) return C.shortCutMs;
  return Math.min(C.legMaxMs, C.legBaseMs + C.legPerKmMs * km);
}

export function buildCinematicPlan(legs, { reducedMotion = false, C = CINE } = {}) {
  const ordered = [...(legs || [])].sort((x, y) => (x.sort ?? 0) - (y.sort ?? 0));
  if (!ordered.length) return { steps: [], stops: [], legs: [], totalMs: 0, cinematic: true };
  const stops = [];
  const addStop = (end, pinId) => { stops.push({ index: stops.length, lat: end.lat, lon: end.lon, v: end.v, pinId: pinId || null, label: end.label || null }); return stops.length - 1; };
  // Home is not a stop on the way out: open on the first place, legs before it are drawn at once.
  let firstLeg = ordered.findIndex((l) => l.fromPinId);
  if (firstLeg < 0) firstLeg = 0;
  const steps = [];
  const s0 = addStop(ordered[firstLeg].a, ordered[firstLeg].fromPinId);
  steps.push({ kind: "open", legIndex: firstLeg - 1, legId: null, stopIndex: s0, ms: reducedMotion ? C.reducedCutMs : C.fadeMs + C.openHoldMs + C.pushMs, preDrawn: firstLeg });
  steps.push({ kind: "hold", legIndex: firstLeg - 1, legId: null, stopIndex: s0, ms: C.holdMs });
  for (let i = firstLeg; i < ordered.length; i++) {
    const leg = ordered[i];
    const km = kmOf(leg);
    const si = addStop(leg.b, leg.toPinId);
    steps.push({ kind: "move", legIndex: i, legId: leg.id, stopIndex: si, ms: reducedMotion ? C.reducedCutMs : cineLegMs(km, C), km, short: km < C.shortKm, mode: leg.mode });
    if (leg.toPinId && i < ordered.length - 1) steps.push({ kind: "hold", legIndex: i, legId: leg.id, stopIndex: si, ms: C.holdMs });
  }
  steps.push({ kind: "end", legIndex: ordered.length - 1, legId: null, stopIndex: stops.length - 1, ms: reducedMotion ? C.reducedCutMs : C.endMs });
  // Over 40 s: scale every hold down evenly.
  let totalMs = steps.reduce((a, s) => a + s.ms, 0);
  if (totalMs > C.maxTotalMs) {
    const holds = steps.filter((s) => s.kind === "hold");
    const holdSum = holds.reduce((a, s) => a + s.ms, 0);
    const k = Math.max(0, (holdSum - (totalMs - C.maxTotalMs)) / holdSum);
    holds.forEach((s) => { s.ms = Math.round(s.ms * k); });
    totalMs = steps.reduce((a, s) => a + s.ms, 0);
  }
  return { steps, stops, legs: ordered, totalMs, cinematic: true };
}

/** Leg draw fraction for a move at raw progress t: the head leads the camera by ~8%. */
export const legDrawAt = (t, C = CINE) => Math.min(1, Math.max(0, t / (1 - C.headLead)));
