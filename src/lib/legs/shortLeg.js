// Legs under 2 km (a border crossed on foot, a short transfer) draw as one small dot at
// the midpoint, with no arc or line. Hover shows "Walk · 0.5 mi".
import { miText } from "../units/distance.js";
export const SHORT_LEG_KM = 2;
const MODE_NAME = { fly: "Fly", drive: "Drive", train: "Train", boat: "Boat", cruise: "Cruise", walk: "Walk", other: "Other" };

export function haversineKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Leg length in km: the stored distance, else great circle between its ends. */
export function legKm(distanceKm, a, b) {
  const d = Number(distanceKm);
  if (distanceKm != null && Number.isFinite(d)) return d;
  return a && b ? haversineKm(a.lat, a.lon, b.lat, b.lon) : null;
}

export const isShortLeg = (km) => km != null && km < SHORT_LEG_KM;

export function shortLegLabel(mode, km) {
  const name = MODE_NAME[mode] || "Other";
  return `${name} · ${miText(km)}`;
}

const TOUCH_KM = 0.05;
/**
 * Make short-leg dots and the legs that touch them share one exact point.
 * items: [{ a: {lat, lon}, b: {lat, lon}, km }]. Returns the same length:
 * [{ a, b, short, dot }], where a short leg's dot is the endpoint its neighbours meet at
 * (or the midpoint when neighbours touch both ends, e.g. a border crossed both ways),
 * and every longer leg's end that touched that short leg is moved onto the dot.
 */
export function snapShortLegs(items) {
  const out = items.map((it) => ({ a: it.a, b: it.b, short: isShortLeg(it.km), dot: null }));
  const near = (p, q) => p && q && haversineKm(p.lat, p.lon, q.lat, q.lon) <= TOUCH_KM;
  const long = out.filter((o) => !o.short);
  for (const s of out) {
    if (!s.short) continue;
    const tA = long.some((l) => near(l.a, s.a) || near(l.b, s.a));
    const tB = long.some((l) => near(l.a, s.b) || near(l.b, s.b));
    s.dot = tA && !tB ? { lat: s.a.lat, lon: s.a.lon } : tB && !tA ? { lat: s.b.lat, lon: s.b.lon } : { lat: (s.a.lat + s.b.lat) / 2, lon: (s.a.lon + s.b.lon) / 2 };
  }
  for (const s of out) {
    if (!s.short) continue;
    for (const l of long) {
      if (near(l.a, s.a) || near(l.a, s.b)) l.a = { ...l.a, ...s.dot, snapped: true };
      if (near(l.b, s.a) || near(l.b, s.b)) l.b = { ...l.b, ...s.dot, snapped: true };
    }
  }
  return out;
}
