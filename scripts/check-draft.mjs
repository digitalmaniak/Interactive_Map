// Node check: trip draft helpers and the stub parser. Run: node scripts/check-draft.mjs
import { LEG_MODES, normalizeDraft, canSave, toRpcDraft, stubParse, warningsFor, hasLocation } from "../src/lib/draft/draft.js";
let failed = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) failed++; };
ok(LEG_MODES.join() === "fly,drive,train,boat,cruise,walk,other", "modes match journey_legs_mode_check");
const d = stubParse("Paris in May 2024, flew from JFK, took the train to Lyon");
ok(d.stops.map((s) => s.name).join() === "Paris,Lyon", `stub finds Paris then Lyon (${d.stops.map((s) => s.name)})`);
ok(d.stops.every(hasLocation) && d.stops[0].date === "2024-05-01", "stub stops have coordinates and the month date");
ok(d.legs.length === 1 && d.legs[0].mode === "train" && d.legs[0].from_stop === 0 && d.legs[0].to_stop === 1, `leg Paris to Lyon by train (${JSON.stringify(d.legs[0])})`);
ok(canSave(d), "draft with all locations can save");
const u = stubParse("Went to Lisbon then Sintra in 2023");
ok(u.stops.length === 2 && !hasLocation(u.stops[1]) && !canSave(u), "unknown place has no location and blocks Save");
ok(warningsFor(u, "stop", 1).length === 1 && warningsFor(u, "stop", 0).length === 0, "warning ties to the unknown stop only");
const n = normalizeDraft({ journey: { title: "x", date_start: "2024-1-1" }, stops: [{ name: "a", lat: 1, lng: 2 }], legs: [{ mode: "plane", from_stop: 0, to_stop: 3 }, { mode: "fly", from_stop: 0, to_stop: 0 }] });
ok(n.journey.date_start === null && n.legs.length === 0, "bad dates nulled, bad leg indices dropped");
const r = toRpcDraft({ ...d, legs: d.legs.map((l) => ({ ...l, guessed: true })) });
ok(!("guessed" in r.legs[0]) && !("from_iata" in r.legs[0]) && "from_label" in r.legs[0], "RPC payload: contract fields only, labels not IATA columns");
ok(normalizeDraft({ stops: [{ name: "a" }], legs: [{ mode: "spaceship", from_stop: 0, to_stop: 0 }] }).legs.length === 0, "self legs dropped");
ok(normalizeDraft({ stops: [{ name: "a", lat: 1, lng: 1 }, { name: "b", lat: 2, lng: 2 }], legs: [{ mode: "spaceship", from_stop: 0, to_stop: 1 }] }).legs[0].mode === "other", "unknown mode becomes other");
process.exit(failed ? 1 : 0);
