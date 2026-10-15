import assert from "node:assert/strict";
import { tripCounts } from "../src/lib/legs/tripHeader.js";
const f = (km) => ({ mode: "fly", distanceKm: km });
assert.deepEqual(tripCounts(2, [f(10800), f(830), f(830), f(10830)]), { stops: "2 STOPS", flights: "4 FLIGHTS", km: "14,472 MI" });
assert.equal(tripCounts(1, [f(100)]).flights, "1 FLIGHT");
assert.equal(tripCounts(1, [f(100)]).stops, "1 STOP");
assert.equal(tripCounts(3, [{ mode: "drive", distanceKm: 50 }]).flights, "");
assert.equal(tripCounts(2, []).km, "");
console.log("check-trip-header: ok");
