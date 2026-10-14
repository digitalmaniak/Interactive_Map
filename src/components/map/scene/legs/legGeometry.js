import * as THREE from "three";
import { homeLegId } from "../../../../lib/legs/homeLeg.js";

// Pure leg geometry (no React), shared by LegsLayer and scripts/check-legs.mjs.
// DESIGN.md "Leg mode styles (v1, build spec)". Globe radius is 1 R.

export const LEG_MODES_DRAWN = ["fly", "drive", "train", "boat", "cruise", "walk", "other"];
export const normLegMode = (m) => (LEG_MODES_DRAWN.includes(m) ? m : "drive");

export const FLY_SEGMENTS = 96;
export const FLY_END_FADE = 0.08; // last 8 percent at each end
export const FLY_END_ALPHA = 0.4;
export const PAIR_OFFSET_DEG = 4;
export const PAIR_OFFSET_FRAC = 0.05;
// Pair offset scales with the leg: 5 percent of its great circle length, capped at 4 deg.
export const pairOffsetDeg = (angRad) => Math.min(PAIR_OFFSET_DEG, PAIR_OFFSET_FRAC * THREE.MathUtils.radToDeg(angRad));
export const FLY_TRIP_SCALE = 0.5; // trip view halves H so arcs stay in frame at 48 deg tilt
const SURFACE_STEP_RAD = THREE.MathUtils.degToRad(0.25);
const PAIR_MATCH_RAD = THREE.MathUtils.degToRad(0.45); // about 50 km

export function llToUnit(lat, lon, out = new THREE.Vector3()) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const th = THREE.MathUtils.degToRad(lon + 180);
  return out.set(-Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
}

// Shared trip zoom value: 0 at trip height, 1 by about 1.5R altitude. Drives trip tilt
// and the fly arc height multiplier (0.5x at trip height, 1.0x by 1.5R).
export const tripZoomK = (alt) => THREE.MathUtils.smoothstep(alt, 0.15, 1.5);
export const flyScaleFor = (alt) => FLY_TRIP_SCALE + (1 - FLY_TRIP_SCALE) * tripZoomK(alt);
// Flight arc peak height H(d) in globe radii for a leg of d radians:
//   H(d) = clamp(0.08 + 0.35 d, 0.04, 0.55) * (1 - exp(-(d / 0.3)^2))
// The base is the DESIGN.md formula; the factor fades short hops down so they peak inside
// the trip frame, and is about 1 for long flights (0.98 at 0.6 rad, 1.0 at EWR distances).
// H(d) is then floored at FLY_MIN_H = 0.04R. Examples before the floor and trip view 0.5x: 300 km (0.047 rad) 0.0023R, Tokyo to Niseko 800 km
// (0.125 rad) 0.0204R, 2000 km (0.31 rad) 0.12R, EWR to Geneva (0.98 rad) 0.42R.
export const FLY_SHORT_RAD = 0.3;
// Floor: every flight keeps a small visible hump (FLY_MIN_H before the zoom blend).
export const FLY_MIN_H = 0.04;
export const flyHeight = (d) => Math.max(FLY_MIN_H, THREE.MathUtils.clamp(0.08 + 0.35 * d, 0.04, 0.55) * (1 - Math.exp(-((d / FLY_SHORT_RAD) ** 2))));

function slerpUnit(a, b, ang, t, out) {
  const s = Math.sin(ang);
  if (s < 1e-9) return out.copy(a).lerp(b, t).normalize();
  const wa = Math.sin((1 - t) * ang) / s, wb = Math.sin(t * ang) / s;
  return out.set(a.x * wa + b.x * wb, a.y * wa + b.y * wb, a.z * wa + b.z * wb);
}

// Rows from journey_legs plus a pin lookup -> drawable legs. Endpoints use the pin's
// coordinates when a pin is set, else the leg's own lat/lng (pinless airport or stop).
// Legs with an unresolvable endpoint are skipped, never thrown on.
export function resolveLegs(rows, pinsById) {
  const out = [];
  for (const r of rows || []) {
    const end = (pinId, lat, lng, label) => {
      const pin = pinId ? pinsById?.[pinId] : null;
      const la = Number(pin ? pin.latitude : lat), lo = Number(pin ? pin.longitude : lng);
      if (pin == null && (lat == null || lng == null)) return null;
      if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
      return { lat: la, lon: lo, pinned: !!pin, label: label || null, place: label || pin?.location_name || pin?.title || null, raw: { lat: la, lon: lo }, v: llToUnit(la, lo) };
    };
    const a = end(r.from_pin_id, r.from_lat, r.from_lng, r.from_label);
    const b = end(r.to_pin_id, r.to_lat, r.to_lng, r.to_label);
    if (!a || !b || a.v.angleTo(b.v) < 1e-7) continue;
    out.push({ id: r.id, mode: normLegMode(r.mode), a, b, toPinId: r.to_pin_id || null, fromPinId: r.from_pin_id || null, distanceKm: r.distance_km == null ? null : Number(r.distance_km), sort: r.sort_order ?? out.length, offsetDeg: 0, departAt: r.depart_at || null, arriveAt: r.arrive_at || null, status: r.status || null });
  }
  // Outbound and return flights on the same route get a sideways offset each (pairOffsetDeg).
  // The rotation is about each leg's own travel direction, so the pair lands on
  // opposite sides of the great circle and runs in opposite directions.
  const flights = out.filter((l) => l.mode === "fly");
  for (const l of flights) {
    if (flights.some((m) => m !== l && m.a.v.angleTo(l.b.v) < PAIR_MATCH_RAD && m.b.v.angleTo(l.a.v) < PAIR_MATCH_RAD)) l.offsetDeg = pairOffsetDeg(l.a.v.angleTo(l.b.v));
  }
  // Return-home flight (last leg, a flight, ending within 50 km of the trip start).
  const homeId = homeLegId(out.map((l) => ({ id: l.id, mode: l.mode, sort: l.sort, departAt: l.departAt, a: { lat: l.a.lat, lon: l.a.lon }, b: { lat: l.b.lat, lon: l.b.lon } })));
  for (const l of out) l.home = homeId != null && l.id === homeId;
  return out;
}

// Fly arc: great circle slerp lifted by h(t) = H sin(pi t), 96 segments, then rotated
// offsetDeg about the chord (endpoints stay put). Returns { points, alpha, H }.
export function flyArc(a, b, { offsetDeg = 0, scale = FLY_TRIP_SCALE, segments = FLY_SEGMENTS } = {}) {
  const ang = a.angleTo(b);
  const H = flyHeight(ang) * scale;
  const axis = b.clone().sub(a).normalize();
  const q = new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(offsetDeg));
  const points = [], alpha = [];
  const u = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    slerpUnit(a, b, ang, t, u);
    const p = u.clone().multiplyScalar(1 + H * Math.sin(Math.PI * t));
    if (offsetDeg) p.sub(a).applyQuaternion(q).add(a);
    points.push(p);
    const e = Math.min(t, 1 - t);
    alpha.push(e >= FLY_END_FADE ? 1 : THREE.MathUtils.lerp(FLY_END_ALPHA, 1, e / FLY_END_FADE));
  }
  return { points, alpha, H };
}

// Surface leg: great circle on the unit sphere, about one point per 0.25 degree.
export function surfacePath(a, b) {
  const ang = a.angleTo(b);
  const n = Math.max(2, Math.ceil(ang / SURFACE_STEP_RAD));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(slerpUnit(a, b, ang, i / n, new THREE.Vector3()));
  return pts;
}

// Same zoom-scaled lift as the border lines: base 1.00004 R, plus up to 0.0003 R from
// the 8 km minimum (0) to full globe view (1), smooth in log altitude.
export function surfaceLiftScale(alt, minAlt = 0.00125, globeAlt = 2.2) {
  const k = THREE.MathUtils.smoothstep(Math.log(Math.max(alt, 1e-6)), Math.log(minAlt), Math.log(globeAlt));
  return 1.00004 * (1 + 0.0003 * k);
}
