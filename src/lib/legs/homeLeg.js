// Return-home flight: the trip's last leg (by order, then date) when it is a flight that
// ends within 50 km of where the trip started (the first leg's start, else the first stop).
// Pure, no three.js, so the globe, the share card (edge) and checks can share it.

// Home arc colour. One constant; the final shade can change here only.
export const ARC_HOME = "#E8D5B0";
// Home arc glow relative to an outbound arc.
export const ARC_HOME_GLOW = 0.7;
export const HOME_RADIUS_KM = 50;

const num = (v) => (v == null || v === "" ? NaN : Number(v));

export function haversineKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const ts = (v) => { const t = v ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : Infinity; };

/**
 * legs: [{ id, mode, sort, departAt, a: { lat, lon } | null, b: { lat, lon } | null }]
 * firstStop: optional { lat, lon } used when the first leg has no start point.
 * Returns the home leg's id, or null.
 */
export function homeLegId(legs, firstStop = null) {
  const list = (legs || []).map((l, i) => ({ l, i })).sort((x, y) => (x.l.sort ?? x.i) - (y.l.sort ?? y.i) || ts(x.l.departAt) - ts(y.l.departAt) || x.i - y.i).map((x) => x.l);
  if (list.length < 2) return null;
  const last = list[list.length - 1];
  if (last.mode !== "fly" || !last.b) return null;
  const start = list[0].a || firstStop;
  if (!start || !Number.isFinite(start.lat) || !Number.isFinite(start.lon)) return null;
  return haversineKm(start, last.b) <= HOME_RADIUS_KM ? last.id : null;
}

/** Leg row end point: the pin when it has coordinates, else the row's own lat/lng. */
export function rowEnd(row, side, pinsById = {}) {
  const p = pinsById[row[`${side}_pin_id`]];
  const plat = num(p?.latitude), plng = num(p?.longitude);
  if (Number.isFinite(plat) && Number.isFinite(plng)) return { lat: plat, lon: plng };
  const lat = num(row[`${side}_lat`]), lng = num(row[`${side}_lng`]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lon: lng } : null;
}

/** homeLegId for raw journey_legs rows (share page and OG card). */
export function homeLegIdFromRows(rows, pins = []) {
  const byId = {};
  for (const p of pins || []) byId[p.id] = p;
  const stops = [...(pins || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const first = stops.map((p) => ({ lat: num(p.latitude), lon: num(p.longitude) })).find((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon)) || null;
  const legs = (rows || []).map((r, i) => ({ id: r.id, mode: r.mode, sort: r.sort_order ?? i, departAt: r.depart_at || null, a: rowEnd(r, "from", byId), b: rowEnd(r, "to", byId) }));
  return homeLegId(legs, first);
}
