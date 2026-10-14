// Node check: Add entry button label. Run: node scripts/check-add-label.mjs
import { addEntryLabel } from "../src/lib/shell/addLabel.js";
let failed = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) failed++; };
ok(addEntryLabel(null).label === "Add entry" && addEntryLabel("  ").label === "Add entry", "world map: Add entry");
const j = addEntryLabel("Japan");
ok(j.label === "Add stop to Japan" && j.title === undefined && j.fallback.label === "Add stop", "short name: Add stop to Japan");
ok(addEntryLabel("Lisbon and Porto 24").label === "Add stop" && addEntryLabel("Lisbon and Porto 24").title === "Add stop to Lisbon and Porto 24", "19 chars: Add stop with full name in the title");
ok(addEntryLabel("Lisbon and Porto 2").label === "Add stop to Lisbon and Porto 2", "18 chars still fits");
process.exit(failed ? 1 : 0);
