// Node check: share itinerary lines, counts, pin order fallback and the OG projection.
// Run: node scripts/check-share.mjs
import { airportCode, legLine, legDate, shareLegs, countsLine, tripDates, projectRoute } from "../src/lib/journeys/shareItinerary.js";

let failed = 0;
const ok = (c, msg) => { console.log(`${c ? "PASS" : "FAIL"} ${msg}`); if (!c) failed++; };
const pins = { lis: { id: "lis", location_name: "Lisbon, Portugal", latitude: "38.72", longitude: "-9.14", start_date: "2024-05-03" }, opo: { id: "opo", location_name: "Porto, Portugal", latitude: "41.15", longitude: "-8.61" } };

ok(airportCode("New York (JFK)") === "JFK" && airportCode("LIS") === "LIS" && airportCode("Lisbon") === null, "airport codes");
ok(legLine({ mode: "fly", from_label: "New York (JFK)", to_label: "Lisbon (LIS)" }, pins) === "JFK to LIS", "fly uses codes");
ok(legLine({ mode: "train", from_pin_id: "lis", to_pin_id: "opo" }, pins) === "Lisbon to Porto", "ground uses pin names");
ok(legLine({ mode: "fly", from_label: "Somewhere", to_pin_id: "lis" }, pins) === "Somewhere to Lisbon", "fly without code falls back");
ok(legLine({ mode: "walk", from_pin_id: "gone", to_pin_id: "opo" }, pins) === "Unnamed stop to Porto", "missing pin is named plainly");
ok(legDate({ depart_at: "2024-05-04T09:00:00Z" }, pins) === "May 4, 2024" && legDate({ from_pin_id: "lis" }, pins) === "May 3, 2024" && legDate({}, pins) === null, "leg dates");
ok(countsLine([{ mode: "fly" }, { mode: "fly" }, { mode: "fly" }, { mode: "drive" }, { mode: "walk" }, { mode: "walk" }, { mode: "cruise" }, { mode: "boat" }]) === "3 flights, 1 drive, 2 boats, 2 walks", "counts line, cruise with boats");
ok(countsLine([]) === "", "empty counts");
ok(tripDates({ date_start: "2024-05-03", date_end: "2024-05-12" }) === "May 3, 2024 to May 12, 2024" && tripDates({}) === "", "trip dates");
const fb = shareLegs([], [{ ...pins.opo, sort_order: 2 }, { ...pins.lis, sort_order: 1 }, { id: "x", latitude: null, longitude: null, sort_order: 3 }]);
ok(fb.length === 1 && fb[0].from_pin_id === "lis" && fb[0].mode === "other", "pin order fallback skips unlocated pins");
ok(shareLegs([{ id: "b", sort_order: 2 }, { id: "a", sort_order: 1 }], []).map((l) => l.id).join() === "a,b", "real legs sorted");

const W = 1200, H = 630;
const legs = [
  { mode: "fly", from_lat: 40.64, from_lng: -73.78, to_pin_id: "lis" }, // null from pin: own lat/lng
  { mode: "train", from_pin_id: "lis", to_pin_id: "opo" },
  { mode: "walk", from_pin_id: "opo", to_lat: 41.14, to_lng: -8.62 },
  { mode: "drive", from_pin_id: "nope", to_pin_id: "alsonope" }, // dropped
];
const r = projectRoute(legs, Object.values(pins), { width: W, height: H });
ok(r.segs.length === 3, "unresolvable leg dropped");
const xs = r.segs.flatMap((s) => [s.x1, s.x2]), ys = r.segs.flatMap((s) => [s.y1, s.y2]);
ok(Math.min(...xs) >= W * 0.15 - 0.5 && Math.max(...xs) <= W * 0.85 + 0.5 && Math.min(...ys) >= H * 0.15 - 0.5 && Math.max(...ys) <= H * 0.85 + 0.5, "fits inside 15% padding");
ok(Math.abs(Math.min(...xs) - W * 0.15) < 1 || Math.abs(Math.min(...ys) - H * 0.15) < 1, "touches the padding on one axis");
ok(r.segs[0].cx != null && r.segs[1].cx == null, "fly gets an arc control point");
const pac = projectRoute([{ mode: "fly", from_lat: 35.55, from_lng: 139.78, to_lat: 21.32, to_lng: -157.92 }], [], { width: W, height: H });
ok(pac.segs[0].x2 > pac.segs[0].x1, "antimeridian unwrap: Tokyo to Honolulu goes east");
ok(projectRoute([], [], { width: W, height: H }).dots.length === 0, "empty route");
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
