// Timezone shift check: date-only values must format as their calendar date in any zone.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
if (!process.env.__CAL_CHILD) {
  for (const tz of ["America/New_York", "America/Los_Angeles", "Pacific/Kiritimati", "UTC"]) {
    execFileSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, TZ: tz, __CAL_CHILD: "1" }, stdio: "inherit" });
  }
  console.log("check-calendar: ok");
  process.exit(0);
}
const { fmtMonthYear, fmtDay, fmtMonthRange, stopDateOrTrip, monthBounds, ymdKey } = await import("../src/lib/dates/calendar.js");
const { formatJourneyDates } = await import("../src/lib/journeys/format.js");
const { formatPinDate } = await import("../src/lib/pins/format.js");
const { tripDates } = await import("../src/lib/journeys/shareItinerary.js");
const tz = process.env.TZ;
const cr = { date_start: "2023-09-01", date_end: "2023-09-14" };
assert.equal(formatJourneyDates(cr), "Sep 2023", `${tz}: panel shows Sep 2023, not Aug`);
assert.equal(formatPinDate("2023-09-01"), "Sep 2023", tz);
assert.equal(fmtDay("2023-09-01"), "Sep 1, 2023", tz);
assert.equal(tripDates(cr), "Sep 1, 2023 to Sep 14, 2023", tz);
assert.equal(fmtMonthYear("2025-01-01T00:00:00+00:00"), "Jan 2025", tz);
assert.equal(fmtMonthRange("2025-01-20", "2025-02-03"), "Jan 2025 – Feb 2025");
assert.deepEqual(stopDateOrTrip({ start_date: null }, cr), { text: "Sep 2023", fallback: true });
assert.deepEqual(stopDateOrTrip({ start_date: "2023-09-05" }, cr), { text: "Sep 2023", fallback: false });
assert.deepEqual(monthBounds(2025, 6), { start: "2025-06-01", end: "2025-06-30" });
assert.deepEqual(monthBounds(2024, 2), { start: "2024-02-01", end: "2024-02-29" });
assert.ok(ymdKey("2023-09-01") < ymdKey("2023-09-02") && ymdKey(null) === Infinity);
