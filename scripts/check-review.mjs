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
const g2 = groupReviewItems([{ kind: "draft_leg", journey_id: "s1", item_id: "a" }, { kind: "draft_leg", journey_id: "s2", item_id: "b" }], [{ id: "s1", title: "Snowboarding", places: [{ start_date: "2019-02-14" }, { start_date: "2019-03-01" }] }, { id: "s2", title: "Snowboarding", places: [{ start_date: "2024-12-30" }] }]);
ok(g2.map((x) => x.title).join("|") === "Snowboarding \u00b7 Feb 2019|Snowboarding \u00b7 Dec 2024", `same named trips get month and year: ${g2.map((x) => x.title)}`);
ok(g.length === 2 && g[0].title === "Euro Enduro" && g[1].title === "Imported", "grouped by journey, sorted by title");
ok(g[0].stops.length === 1 && g[0].legs.length === 1, "stops and legs split per journey");
ok(validStopDates("", "") === "Pick a start date.", "start date required");
ok(validStopDates("2025-01-02", "") === null, "end date optional");
ok(validStopDates("2025-01-02", "2025-01-01") === "End date is before the start date.", "end before start rejected");
const g3 = groupReviewItems([{ kind: "undated_stop", journey_id: "a", item_id: "x" }], [{ id: "a", title: "Acatenango Volcano Hike", date_start: "2025-08-18", date_end: "2025-08-25", places: [{ start_date: null }] }]);
ok(g3[0].title === "Acatenango Volcano Hike \u00b7 Aug 2025", `undated stops fall back to journeys.date_start: ${g3[0].title}`);
const g4 = groupReviewItems([{ kind: "undated_stop", journey_id: "a", item_id: "x" }], [{ id: "a", title: "T", date_start: "2020-01-01", places: [{ start_date: "2019-02-03" }] }]);
ok(g4[0].title === "T \u00b7 Feb 2019", "stop dates win over the trip start");
process.exit(failed ? 1 : 0);
