import assert from "node:assert/strict";
import { isShortLeg, legKm, shortLegLabel, haversineKm } from "../src/lib/legs/shortLeg.js";
import { projectRoute } from "../src/lib/journeys/shareItinerary.js";
assert.equal(shortLegLabel("walk", 0.800487), "Walk · 0.8 km");
assert.equal(shortLegLabel("rocket", 1.2), "Other · 1.2 km");
assert.ok(isShortLeg(0.8) && !isShortLeg(2) && !isShortLeg(null));
assert.equal(legKm(0.8, null, null), 0.8);
assert.ok(Math.abs(legKm(null, { lat: 9.5, lon: -82.62 }, { lat: 9.5, lon: -82.6127 }) - 0.8) < 0.05);
assert.ok(Math.abs(haversineKm(0, 0, 0, 1) - 111.19) < 0.1);
// OG route: a short walk becomes a midpoint dot, never a segment.
const pins = [{ id: "a", latitude: 9.6586, longitude: -82.7547 }, { id: "b", latitude: 9.34, longitude: -82.2404 }];
const legs = [
  { id: 1, mode: "drive", from_pin_id: "a", to_lat: 9.5000, to_lng: -82.6200, distance_km: 21 },
  { id: 2, mode: "walk", from_lat: 9.5000, from_lng: -82.6200, to_lat: 9.5000, to_lng: -82.6127, distance_km: 0.8 },
  { id: 3, mode: "boat", from_lat: 9.5000, from_lng: -82.6127, to_pin_id: "b", distance_km: 45.6 },
];
const r = projectRoute(legs, pins, { width: 1200, height: 630 });
assert.equal(r.segs.length, 2);
assert.ok(!r.segs.some((s) => s.mode === "walk"));
assert.equal(r.shortDots.length, 1);
console.log("check-short-leg: ok");
