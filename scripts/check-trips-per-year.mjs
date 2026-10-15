import assert from "node:assert/strict";
import { tripsPerYear } from "../src/lib/stats/tripsPerYear.js";
const j = [{ title: "A", date_start: "2024-03-01" }, { title: "B", date_start: "2024-11-02" }, { title: "Imported", date_start: "2024-01-01" }, { title: "C", date_start: null }, { title: "D", date_start: "2026-01-05" }, { title: "E", date_start: "2019-06-01", deleted_at: "x" }];
assert.deepEqual(tripsPerYear(j), [{ year: 2024, n: 2 }, { year: 2026, n: 1 }]);
assert.deepEqual(tripsPerYear([]), []);
console.log("check-trips-per-year: ok");
