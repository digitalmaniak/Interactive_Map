// Share view helpers: plain words leg lines, counts, and a flat route projection for the
// Open Graph card. Pure functions, safe on the edge runtime.

import { homeLegIdFromRows } from "../legs/homeLeg.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const num = (v) => (v == null || v === "" ? NaN : Number(v));

/** "New York (JFK)" -> "JFK", "JFK" -> "JFK", else null. */
export function airportCode(label) {
  const s = String(label || "").trim();
  if (/^[A-Z]{3}$/.test(s)) return s;
  const m = s.match(/\(([A-Z]{3})\)/);
  return m ? m[1] : null;
}

/** First part of a place name: "Lisbon, Portugal" -> "Lisbon". */
export function shortPlace(name) {
  return String(name || "").split(",")[0].trim();
}

function endName(leg, side, pinsById) {
  const label = leg[`${side}_label`];
  if (leg.mode === "fly") {
    const code = airportCode(label);
    if (code) return code;
  }
  const pin = pinsById[leg[`${side}_pin_id`]];
  return shortPlace(label) || shortPlace(pin?.location_name) || shortPlace(pin?.title) || "Unnamed stop";
}

/** "JFK to LIS", "Lisbon to Porto". */
export function legLine(leg, pinsById = {}) {
  return `${endName(leg, "from", pinsById)} to ${endName(leg, "to", pinsById)}`;
}

/** "May 3, 2024" from an ISO date or timestamp; null when missing. */
export function shortDate(v) {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/** Leg date: its own departure, else the start date of its first stop. */
export function legDate(leg, pinsById = {}) {
  return shortDate(leg.depart_at) || shortDate(pinsById[leg.from_pin_id]?.start_date) || null;
}

/**
 * Legs for the share view. Real leg rows when the share token can read them. Otherwise
 * stop to stop in pin order, with mode "other", so the list and route still show.
 */
export function shareLegs(legRows, pins) {
  const rows = (legRows || []).filter((l) => !l.deleted_at);
  if (rows.length) return [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const stops = [...(pins || [])]
    .filter((p) => Number.isFinite(num(p.latitude)) && Number.isFinite(num(p.longitude)))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const out = [];
  for (let i = 0; i + 1 < stops.length; i++) {
    out.push({ id: `pinleg:${i}`, journey_id: stops[i].journey_id, from_pin_id: stops[i].id, to_pin_id: stops[i + 1].id, from_label: null, to_label: null, from_lat: null, from_lng: null, to_lat: null, to_lng: null, mode: "other", depart_at: null, sort_order: i });
  }
  return out;
}

const COUNT_WORD = { fly: "flight", drive: "drive", train: "train", boat: "boat", cruise: "boat", walk: "walk", other: "other leg" };
const COUNT_ORDER = ["fly", "drive", "train", "boat", "walk", "other"];

/** "3 flights, 4 drives, 2 walks". Cruise counts with boats. */
export function countsLine(legs) {
  const n = {};
  for (const l of legs || []) {
    const k = l.mode === "cruise" ? "boat" : COUNT_WORD[l.mode] ? l.mode : "other";
    n[k] = (n[k] || 0) + 1;
  }
  return COUNT_ORDER.filter((k) => n[k]).map((k) => `${n[k]} ${COUNT_WORD[k]}${n[k] === 1 ? "" : "s"}`).join(", ");
}

/** "May 3, 2024 to May 12, 2024" style range from the journey dates. */
export function tripDates(journey) {
  const a = shortDate(journey?.date_start), b = shortDate(journey?.date_end);
  if (a && b && a !== b) return `${a} to ${b}`;
  return a || b || "";
}

/** Leg end coordinates: the pin when it has coordinates, else the leg's own lat/lng. */
export function legEnds(leg, pinsById = {}) {
  const pt = (side) => {
    const p = pinsById[leg[`${side}_pin_id`]];
    const plat = num(p?.latitude), plng = num(p?.longitude);
    if (Number.isFinite(plat) && Number.isFinite(plng)) return [plng, plat];
    const lat = num(leg[`${side}_lat`]), lng = num(leg[`${side}_lng`]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null;
  };
  const a = pt("from"), b = pt("to");
  return a && b ? { a, b } : null;
}

/**
 * Flat route for the OG card: equirectangular with cos(mid lat) x scale, unwrapped across
 * the antimeridian, fit to the box with 15% padding. Returns { segs, dots } in px.
 * Fly legs get a curved arc control point.
 */
export function projectRoute(legs, pins, { width, height, pad = 0.15 }) {
  const byId = {};
  for (const p of pins || []) byId[p.id] = p;
  const homeId = homeLegIdFromRows(legs, pins);
  const raw = [];
  for (const l of legs || []) { const e = legEnds(l, byId); if (e) raw.push({ mode: l.mode, a: e.a, b: e.b, home: homeId != null && l.id === homeId }); }
  const lone = [];
  if (!raw.length) for (const p of pins || []) { const la = num(p.latitude), lo = num(p.longitude); if (Number.isFinite(la) && Number.isFinite(lo)) lone.push([lo, la]); }
  const pts = raw.length ? raw.flatMap((s) => [s.a, s.b]) : lone;
  if (!pts.length) return { segs: [], dots: [] };
  // Unwrap: when the spread is over 180 degrees, move western points east by 360.
  const lons = pts.map((p) => p[0]);
  const wrap = Math.max(...lons) - Math.min(...lons) > 180;
  const fix = (p) => [wrap && p[0] < 0 ? p[0] + 360 : p[0], p[1]];
  const all = pts.map(fix);
  const minX0 = Math.min(...all.map((p) => p[0])), maxX0 = Math.max(...all.map((p) => p[0]));
  const minY0 = Math.min(...all.map((p) => p[1])), maxY0 = Math.max(...all.map((p) => p[1]));
  const k = Math.cos(((minY0 + maxY0) / 2) * Math.PI / 180) || 1;
  const w = Math.max((maxX0 - minX0) * k, 0.5), h = Math.max(maxY0 - minY0, 0.5);
  const innerW = width * (1 - 2 * pad), innerH = height * (1 - 2 * pad);
  const s = Math.min(innerW / w, innerH / h);
  const cx = ((minX0 + maxX0) / 2) * k, cy = (minY0 + maxY0) / 2;
  const P = (p) => { const q = fix(p); return [width / 2 + (q[0] * k - cx) * s, height / 2 - (q[1] - cy) * s]; };
  const r1 = (v) => Math.round(v * 10) / 10;
  const segs = raw.map((sg) => {
    const [x1, y1] = P(sg.a), [x2, y2] = P(sg.b);
    const seg = { mode: sg.mode, home: sg.home, x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2) };
    if (sg.mode === "fly") {
      const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
      // Bow the arc to the left of travel by 20% of its length.
      seg.cx = r1((x1 + x2) / 2 + (dy / d) * d * 0.2);
      seg.cy = r1((y1 + y2) / 2 - (dx / d) * d * 0.2);
    }
    return seg;
  });
  const seen = new Set();
  const dots = [];
  for (const p of pts) { const [x, y] = P(p); const key = `${Math.round(x)}:${Math.round(y)}`; if (!seen.has(key)) { seen.add(key); dots.push({ x: r1(x), y: r1(y) }); } }
  return { segs, dots };
}
