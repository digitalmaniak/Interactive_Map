import { makeScale, allTimeRange, yearTicks, tripMarks, zoomRange, dayTicks, placeLegs, planAnchors, timeToDate, dateToTime, STRIP, DAY, toMs, tripTimeline, stopPositions, overlapGroups, nearestStop } from "../src/components/timeline/timelineLogic.js";
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
// Trips with no dated stop: trip range first, else an "Undated" range by order.
const acat = { mode: "tripRange", from: "2025-08-18", to: "2025-08-25", stops: [{ id: "a1" }, { id: "a2" }, { id: "a3" }] };
const at = tripTimeline(acat);
const ad = ["a1", "a2", "a3"].map((k) => toMs(at.pinDates[k].start));
ok(!at.undated && at.range.t0 === toMs("2025-08-18") && at.range.t1 === toMs("2025-08-26") && ad[0] < ad[1] && ad[1] < ad[2] && Math.abs((ad[1] - ad[0]) - (ad[2] - ad[1])) < 1, "no dated stop: trip range from journey_stats_v2, stops spread evenly by order");
const un = tripTimeline({ mode: "undated", from: null, stops: acat.stops });
const ul = placeLegs([{ id: "x", mode: "drive", fromPinId: "a1", toPinId: "a2" }, { id: "y", mode: "fly", departAt: null, fromPinId: "a2", toPinId: "a3" }], un.pinDates, un.range);
ok(un.undated && ul.every((l) => l.alpha === 0.4) && ul[0].a < ul[1].a, "no dates at all: undated range, legs by order at 40%");
const dt = tripTimeline({ mode: "dated", from: "2025-01-10", to: "2025-01-12", stops: [{ id: "p", start: "2025-01-10" }] });
ok(!dt.undated && !dt.spread && dt.pinDates.p.start === "2025-01-10", "dated trips unchanged");
// Stop dots at the playhead anchor of their arrival; overlaps; nearest pick.
const plan2 = { steps: [{ kind: "move", ms: 1000, stopIndex: 0 }, { kind: "hold", ms: 1000, stopIndex: 0 }, { kind: "move", ms: 1000, stopIndex: 1 }, { kind: "hold", ms: 1000, stopIndex: 1 }, { kind: "move", ms: 1000, stopIndex: 2 }, { kind: "hold", ms: 1000, stopIndex: 2 }], stops: [{ pinId: "s1" }, { pinId: "s2" }, { pinId: "s3" }], totalMs: 6000 };
const sd = { s1: { start: "2025-01-10" }, s2: { start: "2025-01-10" }, s3: { start: "2025-01-20" } };
const an2 = planAnchors(plan2, ["s1", "s2", "s3"].map((k) => toMs(sd[k].start)), range);
const sc2 = makeScale(range.t0, range.t1, 0, 150);
const dots = stopPositions([{ id: "s1" }, { id: "s2" }, { id: "s3" }], sd, an2, plan2, sc2);
ok(dots.every((d) => { const a = an2.filter((x) => x.stop)[["s1", "s2", "s3"].indexOf(d.id)]; return Math.abs(sc2.x(a.d) - d.x) < 1e-9; }), "stop dot x equals the playhead x at that stop");
const gr = overlapGroups(dots, 8);
ok(gr.get("s1").size === 2 && gr.get("s2") === gr.get("s1") && gr.get("s3").size === 1, `same day stops overlap (+1), others alone`);
ok(nearestStop(dots, dots[1].x + 0.5).id === "s2" && nearestStop(dots, dots[0].x - 0.5).id === "s1", "click picks the dot nearest the cursor");
const real = tripTimeline({ mode: "tripRange", from: "2025-08-18", to: "2025-08-25", stops: [{ id: "a" }, { id: "b" }, { id: "c" }], legs: [
  { sort: 0, departAt: "2025-08-18 15:15:00+00", arriveAt: "2025-08-18 20:06:00+00" }, { sort: 1 }, { sort: 2 }, { sort: 3 }, { sort: 4 },
  { sort: 5, departAt: "2025-08-25 21:23:00+00", arriveAt: "2025-08-26 02:24:00+00" }] });
const rd = ["a", "b", "c"].map((k) => toMs(real.pinDates[k].start)); const lo = toMs("2025-08-18 20:06:00+00"), hi = toMs("2025-08-25 21:23:00+00");
ok(rd.every((d, i) => Math.abs(d - (lo + ((i + 0.5) / 3) * (hi - lo))) < 1), "Acatenango: stops spread evenly between the first flight's arrival and the last flight's departure");
process.exit(failed ? 1 : 0);
