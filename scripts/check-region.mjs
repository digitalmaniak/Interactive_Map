// Region readout: point-in-polygon on countries.json, skipping wrongly wound features.
import { geoArea, geoContains } from "d3-geo";
import fs from "node:fs";
const geo = JSON.parse(fs.readFileSync(new URL("../public/data/countries.json", import.meta.url)));
const hit = geo.features.filter((f) => geoArea(f) < 2 * Math.PI);
const at = (lon, lat) => hit.find((f) => geoContains(f, [lon, lat]))?.properties?.name || null;
let failed = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) failed++; };
const s = at(-82.62, 9.522);
ok(s === "Panama" || s === "Costa Rica", `Sixaola dot reads ${s}`);
ok(at(-84.09, 9.93) === "Costa Rica", "San José reads Costa Rica");
ok(at(-86.25, 12.13) === "Nicaragua", "Managua reads Nicaragua");
ok(at(-40, 30) === null, "open Atlantic reads nothing (no Bermuda)");
console.log(failed ? `${failed} failed` : "all passed"); process.exit(failed ? 1 : 0);
