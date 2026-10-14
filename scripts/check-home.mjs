// Node check: return-home flight detection (globe resolveLegs, share rows, OG segments).
// Run: node scripts/check-home.mjs
import { homeLegId, homeLegIdFromRows, haversineKm, ARC_HOME } from "../src/lib/legs/homeLeg.js";
import { resolveLegs } from "../src/components/map/scene/legs/legGeometry.js";
import { projectRoute } from "../src/lib/journeys/shareItinerary.js";

let failed = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) failed++; };
const EWR = { lat: 40.6895, lng: -74.1745 }, JFK = { lat: 40.6413, lng: -73.7781 };
ok(ARC_HOME === "#E8D5B0", "one home colour constant");
ok(Math.abs(haversineKm({ lat: EWR.lat, lon: EWR.lng }, { lat: JFK.lat, lon: JFK.lng }) - 33.6) < 2, "EWR to JFK is about 34 km");

// Japan: EWR to Tokyo (null from pin), Tokyo to Hokkaido, Hokkaido... back to EWR (null to pin).
const pins = { tokyo: { id: "tokyo", latitude: "35.6762", longitude: "139.6503", sort_order: 1 }, hok: { id: "hok", latitude: "42.80", longitude: "140.69", sort_order: 2 } };
const japan = [
  { id: "out", mode: "fly", from_lat: EWR.lat, from_lng: EWR.lng, to_pin_id: "tokyo", sort_order: 1 },
  { id: "dom", mode: "fly", from_pin_id: "tokyo", to_pin_id: "hok", sort_order: 2 },
  { id: "back", mode: "fly", from_pin_id: "hok", to_lat: EWR.lat, to_lng: EWR.lng, sort_order: 3 },
];
const r = resolveLegs(japan, pins);
ok(r.find((l) => l.id === "back")?.home === true && r.filter((l) => l.home).length === 1, "globe: Japan return to EWR is home, nothing else");
ok(homeLegIdFromRows(japan, Object.values(pins)) === "back", "share rows: Japan return is home");
ok(homeLegIdFromRows([...japan.slice(0, 2), { ...japan[2], to_lat: JFK.lat, to_lng: JFK.lng }], Object.values(pins)) === "back", "lands at JFK (34 km from EWR): still home");
ok(homeLegIdFromRows([...japan.slice(0, 2), { ...japan[2], to_lat: 39.87, to_lng: -75.24 }], Object.values(pins)) === null, "lands at PHL (over 50 km): not home");
ok(homeLegIdFromRows([...japan.slice(0, 2), { ...japan[2], mode: "train" }], Object.values(pins)) === null, "last leg not a flight: not home");
ok(homeLegIdFromRows([japan[2], japan[0], japan[1]], Object.values(pins)) === "back", "order by sort_order, not row order");
// Euro Enduro shape: no return flight in the data.
ok(homeLegIdFromRows(japan.slice(0, 2), Object.values(pins)) === null, "no return flight: no home leg");
ok(homeLegId([{ id: "x", mode: "fly", a: { lat: 1, lon: 1 }, b: { lat: 1, lon: 1.1 } }]) === null, "a single leg is never home");
// First stop fallback when the first leg has no start point.
ok(homeLegId([{ id: "a", mode: "drive", a: null, b: { lat: 10, lon: 10 } }, { id: "b", mode: "fly", a: { lat: 10, lon: 10 }, b: { lat: 0, lon: 0.1 } }], { lat: 0, lon: 0 }) === "b", "falls back to the first stop");
const og = projectRoute(japan, Object.values(pins), { width: 1200, height: 630 });
ok(og.segs.filter((s) => s.home).length === 1 && og.segs[2].home === true, "OG card marks the home arc");
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
