// Node check: quick add pure logic (no network). Run: node scripts/check-quick-add.mjs
import { QUICK_ADD, mapPhoton, mapNominatim, nextIndex, debounce, makeRateGate, shouldSearch, placeLine, geocode, photonQueryUrl } from "../src/lib/geocode/quickAdd.js";

let failed = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) failed++; };

// Mocked geocoder payloads (shape of real Photon and Nominatim responses).
const photon = { features: [
  { geometry: { coordinates: [6.8694, 45.9237] }, properties: { osm_type: "R", osm_id: 1, name: "Chamonix-Mont-Blanc", state: "Auvergne-Rhône-Alpes", country: "France", countrycode: "FR" } },
  { geometry: { coordinates: [6.8694, 45.9237] }, properties: { osm_type: "N", osm_id: 2, name: "Chamonix-Mont-Blanc", state: "Auvergne-Rhône-Alpes", country: "France", countrycode: "FR" } },
  { geometry: { coordinates: [7.0, 46.0] }, properties: { osm_id: 3, name: "Le Tour", city: "Chamonix", state: "Auvergne-Rhône-Alpes", country: "France", countrycode: "fr" } },
  { geometry: { coordinates: [] }, properties: { name: "Broken" } },
  { geometry: { coordinates: [1, 2] }, properties: {} },
] };
const p = mapPhoton(photon);
ok(p.length === 2, "photon: dedupes by name, region and country, drops rows without name or coordinates");
ok(p[0].name === "Chamonix-Mont-Blanc" && p[0].lat === 45.9237 && p[0].lng === 6.8694, "photon: lon/lat order mapped to lat, lng");
ok(p[1].region === "Chamonix, Auvergne-Rhône-Alpes" && p[1].country === "France" && p[1].countryCode === "FR", "photon: region, country, country code");
ok(placeLine(p[1]) === "Chamonix, Auvergne-Rhône-Alpes, France", "placeLine joins region and country");
const nom = [{ osm_type: "relation", osm_id: 9, lat: "42.8048", lon: "140.6874", name: "Niseko", display_name: "Niseko, Abuta, Hokkaido, Japan", address: { town: "Niseko", state: "Hokkaido", country: "Japan", country_code: "jp" } }, { lat: "x", lon: "1", name: "bad" }];
const n = mapNominatim(nom);
ok(n.length === 1 && n[0].lat === 42.8048 && n[0].lng === 140.6874 && n[0].region === "Hokkaido" && n[0].countryCode === "JP", "nominatim: strings to numbers, town equal to name not repeated in region");
ok(mapPhoton(null).length === 0 && mapNominatim({}).length === 0, "empty or malformed payloads map to no results");

ok(nextIndex("ArrowDown", -1, 3) === 0 && nextIndex("ArrowDown", 2, 3) === 0, "ArrowDown starts at 0 and wraps");
ok(nextIndex("ArrowUp", 0, 3) === 2 && nextIndex("ArrowUp", -1, 3) === 2 && nextIndex("ArrowUp", 2, 3) === 1, "ArrowUp wraps to the last");
ok(nextIndex("ArrowDown", 0, 0) === -1 && nextIndex("x", 1, 3) === 1, "no results: -1; other keys keep the index");

ok(!shouldSearch("a") && !shouldSearch("  b ") && shouldSearch("ni"), `min ${QUICK_ADD.minChars} characters`);

// Debounce on a fake clock: only the last call within 350 ms fires.
{
  let now = 0; const q = [];
  const timers = { set: (f, ms) => { const t = { at: now + ms, f }; q.push(t); return t; }, clear: (t) => { const i = q.indexOf(t); if (i >= 0) q.splice(i, 1); } };
  const adv = (ms) => { now += ms; for (const t of [...q].sort((a, b) => a.at - b.at)) if (t.at <= now) { q.splice(q.indexOf(t), 1); t.f(); } };
  const fired = [];
  const d = debounce((v) => fired.push(v), QUICK_ADD.debounceMs, timers);
  d("n"); adv(100); d("ni"); adv(100); d("nis"); adv(349);
  ok(fired.length === 0, "debounce: nothing before 350 ms of quiet");
  adv(1);
  ok(fired.join() === "nis", "debounce: fires once with the last value");
  d("x"); d.cancel(); adv(1000);
  ok(fired.length === 1, "debounce: cancel drops the pending call");
}

// Rate gate: at most one request per second.
{
  let now = 1000;
  const g = makeRateGate(QUICK_ADD.minGapMs, () => now);
  ok(g.waitMs() === 0, "gate: first request goes at once"); g.mark();
  now += 300; ok(g.waitMs() === 700, "gate: second request 300 ms later waits 700 ms");
  now += 700; ok(g.waitMs() === 0, "gate: free again after 1 s");
}

// Geocode with mocked fetch: photon first, nominatim fallback, errors and abort.
{
  const calls = [];
  const res = (body, okk = true) => ({ ok: okk, status: okk ? 200 : 503, json: async () => body });
  let now = 0; const sleeps = [];
  const gate = makeRateGate(1000, () => now);
  const sleep = async (ms) => { sleeps.push(ms); now += ms; };
  const f1 = async (url) => { calls.push(url); return res(photon); };
  const r1 = await geocode("chamonix", { fetchImpl: f1, gate, sleep });
  ok(r1.source === "photon" && r1.results.length === 2 && calls.length === 1 && calls[0] === photonQueryUrl("chamonix"), "geocode: photon answers, no fallback");
  const f2 = async (url) => { calls.push(url); return url.includes("photon") ? res({}, false) : res(nom); };
  const r2 = await geocode("niseko", { fetchImpl: f2, gate, sleep });
  ok(r2.source === "nominatim" && r2.results[0].name === "Niseko", "geocode: photon error falls back to nominatim");
  ok(sleeps.length >= 1 && sleeps.every((s) => s <= 1000), "geocode: requests spaced by the 1 per second gate");
  const f3 = async (url) => (url.includes("photon") ? res({ features: [] }) : res([]));
  const r3 = await geocode("zzzz", { fetchImpl: f3, gate, sleep });
  ok(r3.results.length === 0, "geocode: empty everywhere returns no results (UI shows a note)");
  let threw = null;
  try { await geocode("x y", { fetchImpl: async () => res({}, false), gate, sleep }); } catch (e) { threw = e; }
  ok(threw && /geocoder 503/.test(threw.message), "geocode: both down throws (UI shows unavailable)");
  const ac = new AbortController(); ac.abort();
  let aborted = false;
  try { await geocode("paris", { fetchImpl: f1, gate, sleep, signal: ac.signal }); } catch (e) { aborted = e.name === "AbortError"; }
  ok(aborted, "geocode: stale (aborted) request rejects with AbortError and never falls back");
}
// Lisbon: the city wins over the municipality and district results (real Photon shape).
{
  const lis = { features: [
    { geometry: { coordinates: [-9.29, 38.995] }, properties: { osm_id: 11, name: "Lisboa", type: "county", state: "Lisbon", country: "Portugal", countrycode: "PT" } },
    { geometry: { coordinates: [-9.20, 38.90] }, properties: { osm_id: 12, name: "Lisbon", type: "district", state: "Lisbon", country: "Portugal", countrycode: "PT" } },
    { geometry: { coordinates: [-9.1365919, 38.7077507] }, properties: { osm_id: 13, name: "Lisbon", type: "city", state: "Lisbon", country: "Portugal", countrycode: "PT" } },
    { geometry: { coordinates: [-9.14, 38.72] }, properties: { osm_id: 14, name: "Lisbon", type: "city", state: "Lisbon", country: "Portugal", countrycode: "PT" } },
    { geometry: { coordinates: [-70.1, 44.0] }, properties: { osm_id: 15, name: "Lisbon", type: "town", state: "Maine", country: "United States", countrycode: "US" } },
  ] };
  const r = mapPhoton(lis);
  ok(r[0].name === "Lisbon" && Math.abs(r[0].lat - 38.72) < 0.03 && Math.abs(r[0].lng + 9.14) < 0.03, `Lisbon: first result is the city near 38.72, -9.14 (${r[0].lat}, ${r[0].lng})`);
  ok(r.filter((x) => x.name === "Lisbon" && x.country === "Portugal").length === 1, "Lisbon: city and district with the same name, region and country collapse to one");
  ok(r.some((x) => x.country === "United States"), "Lisbon, Maine stays (different region and country)");
  const nm = mapNominatim([{ lat: "38.99", lon: "-9.29", name: "Lisboa", addresstype: "municipality", address: { state: "Lisbon", country: "Portugal", country_code: "pt" } }, { lat: "38.7077", lon: "-9.1366", name: "Lisbon", addresstype: "city", address: { state: "Lisbon", country: "Portugal", country_code: "pt" } }]);
  ok(nm[0].name === "Lisbon" && nm[0].lat > 38.7 && nm[0].lat < 38.73, "nominatim: city ranks above municipality");
}
process.exit(failed ? 1 : 0);
