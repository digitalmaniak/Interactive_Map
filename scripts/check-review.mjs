// Pure checks for the review screen helpers. No network, no database.
import { groupReviewItems, validStopDates } from "../src/lib/review/logic.js";
let failed = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) failed++; };
const items = [
  { kind: "undated_stop", journey_id: "j2", item_id: "p1", label: "Niseko", detail: null },
  { kind: "draft_leg", journey_id: "j1", item_id: "l1", label: "Chamonix to Zermatt", detail: "drive" },
  { kind: "undated_stop", journey_id: "j1", item_id: "p2", label: "Verbier", detail: null },
];
const g = groupReviewItems(items, [{ id: "j1", title: "Euro Enduro" }, { id: "j2", title: "Imported" }]);
ok(g.length === 2 && g[0].title === "Euro Enduro" && g[1].title === "Imported", "grouped by journey, sorted by title");
ok(g[0].stops.length === 1 && g[0].legs.length === 1, "stops and legs split per journey");
ok(validStopDates("", "") === "Pick a start date.", "start date required");
ok(validStopDates("2025-01-02", "") === null, "end date optional");
ok(validStopDates("2025-01-02", "2025-01-01") === "End date is before the start date.", "end before start rejected");
process.exit(failed ? 1 : 0);
