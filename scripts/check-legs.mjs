// Node check: fly arc geometry and the outbound/return pair offset.
// Run: node scripts/check-legs.mjs
import * as THREE from "three";
import { resolveLegs, flyArc, flyHeight, FLY_TRIP_SCALE, surfacePath } from "../src/components/map/scene/legs/legGeometry.js";

let failed = 0;
const ok = (c, msg) => { console.log(`${c ? "PASS" : "FAIL"} ${msg}`); if (!c) failed++; };
const EWR = { lat: 40.6895, lng: -74.1745 }, NRT = { lat: 35.6762, lng: 139.6503 }, GVA = { lat: 46.2381, lng: 6.109 };
const pins = { tokyo: { latitude: "35.676200", longitude: "139.650300" } };
const rows = [
  { id: "out", mode: "fly", from_lat: EWR.lat, from_lng: EWR.lng, to_pin_id: "tokyo" },
  { id: "back", mode: "fly", from_pin_id: "tokyo", to_lat: EWR.lat, to_lng: EWR.lng },
  { id: "solo", mode: "fly", from_lat: EWR.lat, from_lng: EWR.lng, to_lat: GVA.lat, to_lng: GVA.lng },
  { id: "odd", mode: "hovercraft", from_lat: GVA.lat, from_lng: GVA.lng, to_lat: 45.9776, to_lng: 6.9356 },
  { id: "bad", mode: "drive", from_lat: null, from_lng: null, to_pin_id: "missing" },
];
const legs = resolveLegs(rows, pins);
ok(legs.length === 4, `resolved 4 drawable legs, skipped the unresolvable one (got ${legs.length})`);
ok(legs.find((l) => l.id === "odd").mode === "drive" && resolveLegs([{ id: "w", mode: "walk", from_lat: 1, from_lng: 1, to_lat: 1.1, to_lng: 1.1 }], {})[0].mode === "walk", "walk keeps its own style; only a truly unknown mode draws as drive");
const out = legs.find((l) => l.id === "out"), back = legs.find((l) => l.id === "back"), solo = legs.find((l) => l.id === "solo");
ok(out.offsetDeg === 4 && back.offsetDeg === 4 && solo.offsetDeg === 0, "pair offset 4 deg on EWR<->Tokyo only");

for (const l of [out, solo]) {
  const arc = flyArc(l.a.v, l.b.v, { offsetDeg: l.offsetDeg });
  const d = l.a.v.angleTo(l.b.v);
  ok(arc.points.length === 97, `${l.id}: 96 segments (${arc.points.length} points)`);
  ok(arc.points[0].distanceTo(l.a.v) < 1e-9 && arc.points[96].distanceTo(l.b.v) < 1e-9, `${l.id}: endpoints on the surface at the stops`);
  const peak = Math.max(...arc.points.map((p) => p.length() - 1));
  ok(Math.abs(peak - flyHeight(d) * FLY_TRIP_SCALE) < 0.002, `${l.id}: peak height ${peak.toFixed(4)} R vs H*0.5 = ${(flyHeight(d) * FLY_TRIP_SCALE).toFixed(4)} R (d=${d.toFixed(3)} rad)`);
  ok(arc.alpha[0] === 0.4 && arc.alpha[96] === 0.4 && arc.alpha[48] === 1, `${l.id}: end fade 40 percent, full mid`);
}
// Pair: midpoints on opposite sides of the great circle plane, each rotated 4 deg about the chord.
const aOut = flyArc(out.a.v, out.b.v, { offsetDeg: 4 }), aBack = flyArc(back.a.v, back.b.v, { offsetDeg: 4 });
const plain = flyArc(out.a.v, out.b.v, { offsetDeg: 0 });
const nrm = out.a.v.clone().cross(out.b.v).normalize();
const sOut = aOut.points[48].dot(nrm), sBack = aBack.points[48].dot(nrm);
ok(Math.sign(sOut) === -Math.sign(sBack) && Math.abs(sOut + sBack) < 1e-6, `pair midpoints on opposite sides (${sOut.toFixed(4)}, ${sBack.toFixed(4)})`);
const chordMid = out.a.v.clone().add(out.b.v).multiplyScalar(0.5);
const rot = THREE.MathUtils.radToDeg(plain.points[48].clone().sub(chordMid).angleTo(aOut.points[48].clone().sub(chordMid)));
ok(Math.abs(rot - 4) < 0.01, `outbound arc rotated ${rot.toFixed(3)} deg about the chord`);
ok(aBack.points[0].distanceTo(out.b.v) < 1e-9, "return runs the opposite direction (starts at Tokyo)");
const sp = surfacePath(GVA && llToUnitWrap(GVA), llToUnitWrap({ lat: 45.9776, lng: 6.9356 }));
ok(sp.every((p) => Math.abs(p.length() - 1) < 1e-9), `drive path stays on the unit sphere (${sp.length} points)`);
function llToUnitWrap(p) { return resolveLegs([{ id: "x", mode: "drive", from_lat: p.lat, from_lng: p.lng, to_lat: 0, to_lng: 0 }], {})[0].a.v; }
if (failed) process.exit(1);

// Buffer sanity for both test trips (coordinates as read from journey_legs and pins).
{
  const { resolveLegs: R, flyArc: F, surfacePath: S, flyScaleFor } = await import("../src/components/map/scene/legs/legGeometry.js");
  const P = (id, latitude, longitude) => ({ id, latitude, longitude });
  const pins = [P("gm", 45.98, 6.94), P("co", 45.79, 6.97), P("ve", 46.10, 7.23), P("an", 46.64, 8.59), P("so", 46.96, 11.01), P("sa", 47.13, 10.27), P("tk", 35.68, 139.69), P("hk", 42.80, 140.69)];
  const L = (id, mode, f, t, extra = {}) => ({ id, mode, from_pin_id: f, to_pin_id: t, ...extra });
  const rows = [
    L(1, "fly", null, "gm", { from_lat: 40.69, from_lng: -74.17 }), L(2, "drive", "gm", "co"), L(3, "drive", "co", "ve"), L(4, "drive", "ve", "an"),
    L(5, "drive", "an", "so"), L(6, "drive", "so", "sa"), L(7, "fly", "sa", null, { to_lat: 40.80, to_lng: -74.01 }),
    L(8, "fly", null, "tk", { from_lat: 40.69, from_lng: -74.17 }), L(9, "fly", "tk", "hk"), L(10, "fly", "hk", "tk"), L(11, "fly", "tk", null, { to_lat: 40.69, to_lng: -74.17 }),
  ];
  const legs = R(rows, Object.fromEntries(pins.map((p) => [p.id, p])));
  let bad = 0;
  const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) bad++; };
  ok(legs.filter((l) => l.mode === "fly").length === 6 && legs.filter((l) => l.mode === "drive").length === 5, "legs classified by mode (6 fly, 5 drive)");
  ok(legs.filter((l) => l.offsetDeg).length === 4 && !legs.some((l) => l.offsetDeg && l.mode !== "fly"), "only the two Japan fly pairs are offset (EWR-Tokyo, Tokyo-Hokkaido); no Euro leg");
  for (const sc of [0.5, flyScaleFor(0.8), 1]) for (const l of legs) {
    const pts = l.mode === "fly" ? F(l.a.v, l.b.v, { offsetDeg: l.offsetDeg, scale: sc }).points : S(l.a.v, l.b.v);
    const flat = pts.flatMap((p) => [p.x, p.y, p.z]);
    ok(flat.every(Number.isFinite) && pts.every((p) => p.length() > 0.99), `leg ${l.id} scale ${sc.toFixed(2)}: no NaN or zero vectors`);
    ok(pts[0].distanceTo(l.a.v) < 1e-3 && pts[pts.length - 1].distanceTo(l.b.v) < 1e-3, `leg ${l.id}: ends within 1e-3R of endpoints`);
    ok(flat.length === pts.length * 3 && (l.mode !== "fly" || pts.length === 97), `leg ${l.id}: segment count matches buffer (${pts.length - 1} segs)`);
  }
  if (bad) process.exit(1);
}
