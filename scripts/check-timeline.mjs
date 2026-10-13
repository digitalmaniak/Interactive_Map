import { makeScale, allTimeRange, yearTicks, tripMarks, zoomRange, dayTicks, placeLegs, planAnchors, timeToDate, dateToTime, STRIP, DAY, toMs } from "../src/components/timeline/timelineLogic.js";
let failed = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) failed++; };
const trips = [{ journey_id: "a", title: "Japan", first_date: "2025-01-10", last_date: "2025-02-02" }, { journey_id: "b", title: "Day", first_date: "2019-05-01", last_date: "2019-05-01" }, { journey_id: "c", title: "Undated", first_date: null }];
const r = allTimeRange(trips, Date.UTC(2026, 9, 13));
ok(new Date(r.t0).getUTCFullYear() === 2019 && new Date(r.t1).getUTCFullYear() === 2027, "all time: first trip year to current year");
ok(yearTicks(r.t0, r.t1).map((t) => t.label).join() === "2019,2020,2021,2022,2023,2024,2025,2026,2027", "year ticks");
const s = makeScale(r.t0, r.t1, 0, 800); const m = tripMarks(trips, s);
ok(m.length === 2 && !m[0].dot && m[1].dot, "short trip becomes a dot, undated trip not drawn");
const z = zoomRange(r, r, toMs("2025-01-20"), 0.001);
ok(Math.abs(z.t1 - z.t0 - STRIP.minSpanMs) < 1 && z.t0 <= toMs("2025-01-20") && z.t1 >= toMs("2025-01-20"), "zoom clamps to 1 year around the cursor");
const zo = zoomRange(z, r, toMs("2025-01-20"), 1e6); ok(zo.t0 === r.t0 && zo.t1 === r.t1, "zoom out clamps to the full range");
const d = dayTicks(toMs("2025-01-10"), toMs("2025-02-03"), 1100); ok(d.filter((x) => x.label).length === 24, "every day labelled when there is room (44px per day)");
const d7 = dayTicks(toMs("2025-01-10"), toMs("2025-02-03"), 300); ok(d7.filter((x) => x.label).length === 4, "every 7th day when tight");
const range = { t0: toMs("2025-01-10"), t1: toMs("2025-02-03") };
const legs = placeLegs([
  { id: 1, mode: "fly", departAt: "2025-01-10T10:00:00Z", arriveAt: "2025-01-11T08:00:00Z", status: "confirmed" },
  { id: 2, mode: "drive", fromPinId: "p1", toPinId: "p2", status: "confirmed" },
  { id: 3, mode: "train", fromPinId: "u1", toPinId: "u2", status: "draft" },
], { p1: { start: "2025-01-12", end: "2025-01-14" }, p2: { start: "2025-01-16" } }, range);
ok(legs.length === 3, "undated legs kept");
ok(!legs[0].guessed && legs[0].alpha === 1 && legs[0].solid, "dated confirmed flight: full strength, solid");
ok(legs[1].guessed && legs[1].a === toMs("2025-01-14") && legs[1].b === toMs("2025-01-16") && legs[1].alpha === 0.4 && !legs[1].solid, "undated leg between its stop dates, 40%, dashed");
ok(legs[2].guessed && legs[2].draft && legs[2].alpha === 0.4 && legs[2].a >= range.t0 && legs[2].b <= range.t1, "both stops undated: spread across trip; draft 40%");
const plan = { steps: [{ kind: "move", ms: 1000, stopIndex: 0 }, { kind: "hold", ms: 1500, stopIndex: 0 }, { kind: "move", ms: 2500, stopIndex: 1 }, { kind: "hold", ms: 1500, stopIndex: 1 }, { kind: "end", ms: 1000, stopIndex: 1 }], totalMs: 7500 };
const an = planAnchors(plan, [toMs("2025-01-10"), toMs("2025-01-20")], range);
ok(timeToDate(an, 1000) === toMs("2025-01-10") && timeToDate(an, 5000) === toMs("2025-01-20"), "playhead: stop arrivals map to stop dates");
ok(Math.abs(dateToTime(an, timeToDate(an, 3000)) - 3000) < 1, "date to time round trips inside a leg");
ok([0, 7500, -5, 9e9].every((t) => Number.isFinite(timeToDate(an, t))), "no NaN at the ends");
const same = planAnchors({ steps: [{ kind: "hold", ms: 1000, stopIndex: 0 }, { kind: "hold", ms: 1000, stopIndex: 1 }, { kind: "hold", ms: 1000, stopIndex: 2 }], totalMs: 3000 }, [toMs("2025-01-10"), toMs("2025-01-10"), toMs("2025-01-10")], range);
ok(same[0].d < same[1].d && same[1].d < same[2].d && same[2].d - same[0].d < DAY, "same-day stops spread inside that day so each is reachable");
process.exit(failed ? 1 : 0);
