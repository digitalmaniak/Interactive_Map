// Node check: flyover plan logic (pure). Run: node scripts/check-flyover.mjs
import { resolveLegs } from "../src/components/map/scene/legs/legGeometry.js";
import { buildFlyoverPlan, legDurationMs } from "../src/components/map/scene/flyover/flyoverPlan.js";
import { FLYOVER, easeInOutCubic } from "../src/components/map/scene/flyover/flyoverTiming.js";

let failed = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) failed++; };
const pin = (id, latitude, longitude) => [id, { id, latitude, longitude }];
const pins = Object.fromEntries([
  pin("gm", 45.9776, 6.9356), pin("co", 45.7969, 6.9686), pin("an", 46.636, 8.594), pin("sa", 47.1287, 10.2683),
  pin("tk", 35.6762, 139.6503), pin("hk", 42.8048, 140.6874),
]);
const euroRows = [
  { id: "e3", sort_order: 3, mode: "drive", from_pin_id: "an", to_pin_id: "sa" },
  { id: "e0", sort_order: 0, mode: "fly", from_lat: 40.69, from_lng: -74.17, from_label: "EWR", to_pin_id: "gm" },
  { id: "e1", sort_order: 1, mode: "drive", from_pin_id: "gm", to_pin_id: "co" },
  { id: "e2", sort_order: 2, mode: "drive", from_pin_id: "co", to_pin_id: "an" },
  { id: "e4", sort_order: 4, mode: "fly", from_pin_id: "sa", to_lat: 40.80, to_lng: -74.01, to_label: "North Bergen" },
];
const japanRows = [
  { id: "j0", sort_order: 0, mode: "fly", from_lat: 40.69, from_lng: -74.17, to_pin_id: "tk" },
  { id: "j1", sort_order: 1, mode: "fly", from_pin_id: "tk", to_pin_id: "hk" },
  { id: "j2", sort_order: 2, mode: "fly", from_pin_id: "hk", to_pin_id: "tk" },
  { id: "j3", sort_order: 3, mode: "fly", from_pin_id: "tk", to_lat: 40.69, to_lng: -74.17 },
];
const euro = buildFlyoverPlan(resolveLegs(euroRows, pins));
const moves = euro.steps.filter((s) => s.kind === "move" && s.legIndex >= 0);
ok(moves.map((s) => s.legId).join(",") === "e0,e1,e2,e3,e4", "legs played in sort order (e0..e4) even when rows arrive shuffled");
ok(euro.steps[0].kind === "move" && euro.steps[0].legIndex === -1 && euro.stops[0].label === "EWR", "intro flies to the first leg's origin (EWR)");
ok(euro.steps.at(-1).kind === "end", "plan ends with a return to the trip fit");
ok(euro.steps.filter((s) => s.kind === "hold").length === 6 && euro.steps.filter((s) => s.kind === "hold").every((s) => s.ms === FLYOVER.holdMs), `hold ${FLYOVER.holdMs} ms at each of the 6 stops`);
ok(euro.stops.map((s) => s.pinId).join(",") === ",gm,co,an,sa,", "stop pins: pinless EWR, Grands Montets, Courmayeur, Andermatt, St. Anton, pinless North Bergen");
ok(moves[0].ms === FLYOVER.longFlightMs && moves[0].long, "EWR to Geneva is a long flight (4 s)");
ok(moves.slice(1, 4).every((s) => s.ms === FLYOVER.shortLegMs && !s.long), "drives take 2.5 s");
ok(moves[4].ms === FLYOVER.longFlightMs, "St. Anton to North Bergen is a long flight (4 s)");
const expect = FLYOVER.introMs + 6 * FLYOVER.holdMs + 2 * FLYOVER.longFlightMs + 3 * FLYOVER.shortLegMs + FLYOVER.outroMs;
ok(euro.totalMs === expect, `Euro total ${euro.totalMs} ms`);
const jp = buildFlyoverPlan(resolveLegs(japanRows, pins));
const jm = jp.steps.filter((s) => s.kind === "move" && s.legIndex >= 0);
ok(jm.map((s) => s.ms).join(",") === `${FLYOVER.longFlightMs},${FLYOVER.shortLegMs},${FLYOVER.shortLegMs},${FLYOVER.longFlightMs}`, "Japan: EWR flights long (4 s), Tokyo to Niseko short (2.5 s)");
ok(legDurationMs(resolveLegs([japanRows[1]], pins)[0]) === FLYOVER.shortLegMs, "800 km flight counts as short");
const rm = buildFlyoverPlan(resolveLegs(euroRows, pins), { reducedMotion: true });
ok(rm.steps.filter((s) => s.kind !== "hold").every((s) => s.ms === FLYOVER.reducedCutMs), `reduced motion: every move is a ${FLYOVER.reducedCutMs} ms crossfade cut`);
ok(rm.steps.length === euro.steps.length && rm.stops.length === euro.stops.length, "reduced motion visits the same stops");
ok(buildFlyoverPlan([]).steps.length === 0, "no legs: empty plan");
ok(easeInOutCubic(0) === 0 && easeInOutCubic(1) === 1 && Math.abs(easeInOutCubic(0.5) - 0.5) < 1e-12, "easeInOutCubic endpoints and midpoint");
process.exit(failed ? 1 : 0);
