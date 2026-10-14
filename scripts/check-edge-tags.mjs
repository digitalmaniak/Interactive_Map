import assert from "node:assert/strict";
import { EDGE, avoidBox, edgePoint, kmText, mergeTags, roundedKm } from "../src/components/map/scene/edgeTagsMath.js";
const r = { x0: 20, y0: 76, x1: 1000, y1: 800 }, c = { x: 510, y: 438 };
assert.deepEqual([edgePoint(c, { x: 1, y: 0 }, r).x, edgePoint(c, { x: 1, y: 0 }, r).y], [1000, 438], "right edge");
assert.equal(edgePoint(c, { x: 0, y: -1 }, r).y, 76, "top edge below the nav");
assert.equal(Math.round(edgePoint(c, { x: -1, y: -1 }, r).x), 148, "diagonal hits the top first");
assert.deepEqual(avoidBox({ x: 100, y: 120 }, { x0: 0, y0: 0, x1: 244, y1: 176 }), { x: 100, y: 176 }, "pushed below the top-left stack");
const unit = (lat, lon) => { const p = lat * Math.PI / 180, l = lon * Math.PI / 180; return { x: Math.cos(p) * Math.sin(l), y: Math.sin(p), z: Math.cos(p) * Math.cos(l) }; };
assert.equal(roundedKm(unit(40.71, -74.0), unit(38.72, -9.14)), 5400, "New York to Lisbon reads 5,400 km");
assert.equal(kmText(5400), "5,400 km");
const m = mergeTags([{ id: "a", x: 100, y: 76 }, { id: "b", x: 130, y: 76 }, { id: "c", x: 400, y: 76 }]);
assert.equal(m.length, 2); assert.equal(m[0].label, "+2"); assert.equal(m[0].merged, true);
assert.equal(EDGE.max, 6);
{
  const { shortName, estWidth } = await import("../src/components/map/scene/edgeTagsMath.js");
  assert.equal(shortName("Park City Mountain (Wasatch Range)").length, 18, "long names cut to 18");
  const wide = mergeTags([{ id: "d", x: 460, y: 76, w: estWidth({ name: "Denver & Vail area", km: "3,400 km" }) }, { id: "p", x: 520, y: 76, w: 200 }]);
  assert.equal(wide.length, 1, "overlapping wide tags merge into +2");
}
console.log("check-edge-tags: ok");
