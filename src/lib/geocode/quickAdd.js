// Quick add: pure helpers (no React, no DOM) so scripts/check-quick-add.mjs can test them.
// Keyless geocoders only: Photon (komoot) first, Nominatim (OSM) as the fallback.
export const QUICK_ADD = {
  debounceMs: 350,
  minChars: 2,
  minGapMs: 1000, // at most one request per second
  limit: 6,
  photonUrl: "https://photon.komoot.io/api/",
  nominatimUrl: "https://nominatim.openstreetmap.org/search",
};

const clean = (s) => (s == null ? "" : String(s).trim());
const num = (x) => (x == null || x === "" ? NaN : Number(x));

// Photon GeoJSON feature -> { id, name, region, country, lat, lng, source }.
export function mapPhoton(json) {
  const out = [];
  for (const f of json?.features || []) {
    const p = f.properties || {};
    const [lng, lat] = f.geometry?.coordinates || [];
    const name = clean(p.name) || clean(p.city) || clean(p.street);
    if (!name || !Number.isFinite(num(lat)) || !Number.isFinite(num(lng))) continue;
    const region = [p.city !== p.name ? p.city : null, p.state].map(clean).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
    out.push({ id: `p:${p.osm_type || ""}${p.osm_id ?? out.length}`, name, region, country: clean(p.country), countryCode: clean(p.countrycode).toUpperCase(), lat: num(lat), lng: num(lng), source: "photon" });
  }
  return dedupe(out);
}

// Nominatim jsonv2 with addressdetails -> same shape.
export function mapNominatim(list) {
  const out = [];
  for (const r of Array.isArray(list) ? list : []) {
    const a = r.address || {};
    const name = clean(r.name) || clean(String(r.display_name || "").split(",")[0]);
    const lat = num(r.lat), lng = num(r.lon);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const city = clean(a.city || a.town || a.village || a.municipality);
    const region = [city !== name ? city : "", clean(a.state || a.region || a.county)].filter(Boolean).join(", ");
    out.push({ id: `n:${r.osm_type || ""}${r.osm_id ?? r.place_id ?? out.length}`, name, region, country: clean(a.country), countryCode: clean(a.country_code).toUpperCase(), lat, lng, source: "nominatim" });
  }
  return dedupe(out);
}

// Same name and place within about 1 km collapse into one suggestion.
function dedupe(list) {
  const seen = new Set();
  return list.filter((r) => {
    const k = `${r.name.toLowerCase()}|${r.country}|${r.lat.toFixed(2)},${r.lng.toFixed(2)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// One line for the "city / location" field of the add form.
export const placeLine = (r) => [r.region, r.country].filter(Boolean).join(", ");

// Keyboard selection over n suggestions; -1 means nothing highlighted.
export function nextIndex(key, i, n) {
  if (!n) return -1;
  if (key === "ArrowDown") return i < 0 ? 0 : (i + 1) % n;
  if (key === "ArrowUp") return i <= 0 ? n - 1 : i - 1;
  if (key === "Home") return 0;
  if (key === "End") return n - 1;
  return i;
}

// Trailing debounce with cancel; clock is injectable for tests.
// Default timers are wrapped: calling a bare setTimeout as a method throws "Illegal invocation" in browsers.
export function debounce(fn, ms, timers = { set: (f, t) => setTimeout(f, t), clear: (id) => clearTimeout(id) }) {
  let t = null;
  const d = (...args) => { if (t) timers.clear(t); t = timers.set(() => { t = null; fn(...args); }, ms); };
  d.cancel = () => { if (t) timers.clear(t); t = null; };
  return d;
}

// Spacing gate: returns how long to wait before the next request may start.
export function makeRateGate(minGapMs = QUICK_ADD.minGapMs, now = () => Date.now()) {
  let last = -Infinity;
  return {
    waitMs() { return Math.max(0, last + minGapMs - now()); },
    mark() { last = now(); },
  };
}

export const shouldSearch = (q) => clean(q).length >= QUICK_ADD.minChars;

export function photonQueryUrl(q, base = QUICK_ADD.photonUrl) {
  return `${base}?q=${encodeURIComponent(clean(q))}&limit=${QUICK_ADD.limit}&lang=en`;
}
export function nominatimQueryUrl(q, base = QUICK_ADD.nominatimUrl) {
  return `${base}?format=jsonv2&addressdetails=1&limit=${QUICK_ADD.limit}&accept-language=en&q=${encodeURIComponent(clean(q))}`;
}

// Photon first; any failure or empty result tries Nominatim. Respects the shared gate and
// the abort signal (stale requests are aborted by the caller).
export async function geocode(q, { signal, gate, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const run = async (url, map) => {
    const w = gate ? gate.waitMs() : 0;
    if (w) await sleep(w);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    gate?.mark();
    const res = await fetchImpl(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`geocoder ${res.status}`);
    return map(await res.json());
  };
  let firstErr = null;
  try {
    const r = await run(photonQueryUrl(q), mapPhoton);
    if (r.length) return { results: r, source: "photon" };
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    firstErr = e;
  }
  try {
    const r = await run(nominatimQueryUrl(q), mapNominatim);
    return { results: r, source: "nominatim" };
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw firstErr || e;
  }
}
