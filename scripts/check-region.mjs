// Region readout: point-in-polygon on countries.json, skipping wrongly wound features.
import { geoArea, geoContains } from "d3-geo";
import fs from "node:fs";
import { countryNames, shortLegRegion } from "../src/lib/legs/shortLegRegion.js";
const geo = JSON.parse(fs.readFileSync(new URL("../public/data/countries.json", import.meta.url)));
const hit = geo.features.filter((f) => geoArea(f) < 2 * Math.PI);
const at = (lon, lat) => hit.find((f) => geoContains(f, [lon, lat]))?.properties?.name || null;
let failed = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) failed++; };
const s = at(-82.62, 9.522);
ok(s === "Panama" || s === "Costa Rica", `border point 9.522,-82.62 polygon lookup reads ${s} (fallback only)`);
ok(at(-84.09, 9.93) === "Costa Rica", "San José reads Costa Rica");
ok(at(-86.25, 12.13) === "Nicaragua", "Managua reads Nicaragua");
ok(at(-40, 30) === null, "open Atlantic reads nothing (no Bermuda)");
// Winding audit: every outer ring under a hemisphere (d3: clockwise), every hole over one.
const backwards = [];
for (const f of geo.features) {
  const g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  polys.forEach((p, pi) => p.forEach((ring, ri) => {
    const a = geoArea({ type: "Polygon", coordinates: [ring] });
    if (ri === 0 ? a > 2 * Math.PI : a < 2 * Math.PI) backwards.push(`${f.properties.name} polygon ${pi} ring ${ri}`);
  }));
}
ok(backwards.length === 0, `no ring wound backwards (${geo.features.length} countries checked)${backwards.length ? ": " + backwards.join(", ") : ""}`);
ok(geo.features.every((f) => geoArea(f) < 2 * Math.PI), "no country bigger than a hemisphere");

// Short-leg dot: countries at the leg's own from and to points.
const names = countryNames(hit);
const nameAt = (ll) => at(ll.lon, ll.lat);
const sixaola = { place: "Sixaola, Costa Rica", lat: 9.5236, lon: -82.62 };
const guabito = { place: "Guabito, Panama (crossed on foot)", lat: 9.5195, lon: -82.614 };
const r1 = shortLegRegion({ a: sixaola, b: guabito }, names, nameAt), r2 = shortLegRegion({ a: sixaola, b: sixaola }, names, nameAt);
const r3 = shortLegRegion({ a: guabito, b: guabito }, names, nameAt);
ok(r1 === "Costa Rica · Panama", `Sixaola to Guabito walk reads "${r1}"`);
ok(r2 === "Costa Rica", `Sixaola alone reads ${r2}`);
ok(r3 === "Panama", `Guabito alone reads ${r3}`);
const r4 = shortLegRegion({ a: { lat: 9.93, lon: -84.09 }, b: { lat: 9.935, lon: -84.085 } }, names, nameAt);
ok(r4 === "Costa Rica", `unlabelled ends fall back to point-in-polygon (${r4})`);
ok(shortLegRegion({}, names, nameAt, { lat: 9.52, lon: -82.62 }) === "Panama", "no ends: dot point-in-polygon is the last fallback");
// Harbor's ISO codes win over names and polygons; direction order is kept.
const inWalk = shortLegRegion({ a: { ...sixaola, country: "CR" }, b: { ...guabito, country: "PA" } }, names, nameAt);
const backWalk = shortLegRegion({ a: { ...guabito, country: "PA" }, b: { ...sixaola, country: "CR" } }, names, nameAt);
ok(inWalk === "Costa Rica · Panama", `walk in (CR to PA) reads "${inWalk}"`);
ok(backWalk === "Panama · Costa Rica", `walk back (PA to CR) reads "${backWalk}"`);
const isoOnly = shortLegRegion({ a: { lat: 0, lon: -150, country: "CR" }, b: { lat: 0, lon: -150, country: "CR" } }, names, nameAt);
ok(isoOnly === "Costa Rica", `ISO code beats an ocean point (${isoOnly})`);
console.log(failed ? `${failed} failed` : "all passed"); process.exit(failed ? 1 : 0);
