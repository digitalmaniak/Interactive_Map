// Trip draft: the shape /api/parse-trip returns and create_journey_from_draft saves.
// { journey: { title, date_start, date_end },
//   stops: [{ name, lat, lng, country_code, date | null, matched_pin_id? }],
//   legs: [{ mode, from_stop, to_stop, date, from_label, to_label }],
//   warnings: [string] }
// Pure helpers only (no React, no network) so scripts/check-draft.mjs can run them.

// Must match journey_legs_mode_check exactly.
export const LEG_MODES = ["fly", "drive", "train", "boat", "cruise", "walk", "other"];
export const MODE_LABEL = { fly: "Fly", drive: "Drive", train: "Train", boat: "Boat", cruise: "Cruise", walk: "Walk", other: "Other" };

const isoOrNull = (d) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
const numOrNull = (x) => (x === null || x === undefined || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));

export function emptyDraft() {
  return { journey: { title: "", date_start: null, date_end: null }, stops: [], legs: [], warnings: [] };
}

export const hasLocation = (s) => !!s && numOrNull(s.lat) != null && numOrNull(s.lng) != null && Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180;

// Clean any draft-like input into the contract shape. Legs with bad indices are dropped.
export function normalizeDraft(d) {
  const out = emptyDraft();
  out.journey.title = String(d?.journey?.title || "").slice(0, 200);
  out.journey.date_start = isoOrNull(d?.journey?.date_start);
  out.journey.date_end = isoOrNull(d?.journey?.date_end);
  out.stops = (Array.isArray(d?.stops) ? d.stops : []).map((s) => {
    const r = { name: String(s?.name || "").trim(), lat: numOrNull(s?.lat), lng: numOrNull(s?.lng), country_code: /^[A-Za-z]{2}$/.test(s?.country_code || "") ? s.country_code.toUpperCase() : null, date: isoOrNull(s?.date) };
    if (s?.matched_pin_id) r.matched_pin_id = String(s.matched_pin_id);
    if (s?.guessed) r.guessed = true;
    return r;
  });
  const n = out.stops.length;
  out.legs = (Array.isArray(d?.legs) ? d.legs : []).filter((l) => Number.isInteger(l?.from_stop) && Number.isInteger(l?.to_stop) && l.from_stop >= 0 && l.to_stop >= 0 && l.from_stop < n && l.to_stop < n && l.from_stop !== l.to_stop).map((l) => ({
    mode: LEG_MODES.includes(l.mode) ? l.mode : "other",
    from_stop: l.from_stop, to_stop: l.to_stop, date: isoOrNull(l.date),
    from_label: l.from_label ? String(l.from_label) : null, to_label: l.to_label ? String(l.to_label) : null,
    ...(l.guessed ? { guessed: true } : {}),
  }));
  out.warnings = (Array.isArray(d?.warnings) ? d.warnings : []).map(String);
  return out;
}

// Save is allowed only when every stop has a real location (and there is at least one).
export const canSave = (d) => Array.isArray(d?.stops) && d.stops.length > 0 && d.stops.every(hasLocation);

// The payload the RPC gets: contract fields only (UI flags like guessed are dropped).
export function toRpcDraft(d) {
  const n = normalizeDraft(d);
  return {
    journey: { title: n.journey.title.trim() || "Untitled trip", date_start: n.journey.date_start, date_end: n.journey.date_end },
    stops: n.stops.map((s) => ({ name: s.name || "Stop", lat: s.lat, lng: s.lng, country_code: s.country_code, date: s.date, ...(s.matched_pin_id ? { matched_pin_id: s.matched_pin_id } : {}) })),
    legs: n.legs.map((l) => ({ mode: l.mode, from_stop: l.from_stop, to_stop: l.to_stop, date: l.date, from_label: l.from_label, to_label: l.to_label })),
    warnings: n.warnings,
  };
}

// Which warnings mention an item: a stop by name or "stop N", a leg by "leg N" or both stop names.
export function warningsFor(d, kind, i) {
  const ws = d?.warnings || [];
  const low = (s) => String(s || "").toLowerCase();
  if (kind === "stop") {
    const name = low(d.stops[i]?.name);
    // Leg warnings ("Leg N: ...") belong to the leg, not to the stops they name.
    return ws.filter((w) => !/^leg \d+/i.test(w) && ((name.length > 1 && low(w).includes(name)) || new RegExp(`\\bstop ${i + 1}\\b`, "i").test(w)));
  }
  const l = d.legs[i];
  if (!l) return [];
  const a = low(d.stops[l.from_stop]?.name), b = low(d.stops[l.to_stop]?.name);
  return ws.filter((w) => new RegExp(`\\bleg ${i + 1}\\b`, "i").test(w) || (a && b && low(w).includes(a) && low(w).includes(b)));
}

// Stub parser for ?stubparse=1 and for when the AI route is not configured. Small fixed
// gazetteer; unknown places come back without coordinates (inline place search fixes them).
const GAZ = {
  paris: ["Paris", 48.8566, 2.3522, "FR"], lyon: ["Lyon", 45.764, 4.8357, "FR"], nice: ["Nice", 43.7102, 7.262, "FR"],
  london: ["London", 51.5072, -0.1276, "GB"], rome: ["Rome", 41.9028, 12.4964, "IT"], lisbon: ["Lisbon", 38.7223, -9.1393, "PT"],
  tokyo: ["Tokyo", 35.6762, 139.6503, "JP"], kyoto: ["Kyoto", 35.0116, 135.7681, "JP"], barcelona: ["Barcelona", 41.3874, 2.1686, "ES"],
  madrid: ["Madrid", 40.4168, -3.7038, "ES"], berlin: ["Berlin", 52.52, 13.405, "DE"], amsterdam: ["Amsterdam", 52.3676, 4.9041, "NL"],
};
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MODE_WORDS = [["fly", /\b(flew|fly|flight|plane)\b/], ["train", /\b(train|rail)\b/], ["drive", /\b(drove|drive|car|road trip)\b/], ["boat", /\b(boat|ferry)\b/], ["cruise", /\bcruise\b/], ["walk", /\b(walk|walked|hike|hiked)\b/]];
const MON3 = MONTHS.map((m) => m.slice(0, 3));
/** First date in the text that names a day: 2024-05-03, May 3 2024, 3 May 2024. Else null. */
export function explicitDate(text) {
  const t = String(text || "");
  const iso = t.match(/\b((?:19|20)\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const mon = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
  const pad = (n) => String(n).padStart(2, "0");
  const ok = (y, m, d) => (d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);
  let m = t.match(new RegExp(`\\b${mon}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+((?:19|20)\\d{2})\\b`, "i"));
  if (m) return ok(m[3], MON3.indexOf(m[1].toLowerCase()) + 1, Number(m[2]));
  m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${mon}\\s+((?:19|20)\\d{2})\\b`, "i"));
  if (m) return ok(m[3], MON3.indexOf(m[2].toLowerCase()) + 1, Number(m[1]));
  return null;
}

/** True when the text states the day of this ISO date (the date itself, or its day number). */
export function dayStated(text, iso) {
  const m = String(iso || "").match(/^\d{4}-\d{2}-(\d{2})$/);
  if (!m) return false;
  const t = String(text || "");
  if (t.includes(iso)) return true;
  const d = Number(m[1]);
  return new RegExp(`(^|[^\\d])0?${d}(st|nd|rd|th)?([^\\d]|$)`, "i").test(t.replace(/\b(19|20)\d{2}\b/g, " "));
}

/** Live per-stop warning: a stop with no date (shown amber, never filled in for you). */
export const NO_DATE_WARNING = "No date yet. Add it if you know it.";

const AIRPORT_RE = /\b(?:from|to)\s+([A-Z]{3})\b/;

export function stubParse(text) {
  const t = String(text || "");
  const low = t.toLowerCase();
  const warnings = ["Stub parser: places and dates are a rough guess. Check each one before saving."];
  const found = [];
  for (const [k, g] of Object.entries(GAZ)) { const i = low.search(new RegExp(`\\b${k}\\b`)); if (i >= 0) found.push({ i, g }); }
  // Capitalised words after "to", "in", "visited" or "then" that are not known places: stops
  // without a location. Three letter airport codes are skipped.
  const re = /\b(?:to|in|visited|then)\s+([A-Z][a-z\u00C0-\u017F-]+(?:\s[A-Z][a-z\u00C0-\u017F-]+)?)/g;
  let m;
  while ((m = re.exec(t))) {
    const name = m[1];
    const k = name.toLowerCase();
    if (GAZ[k] || MONTHS.includes(k) || found.some((f) => f.name === name)) continue;
    found.push({ i: m.index + m[0].indexOf(name), name });
  }
  found.sort((a, b) => a.i - b.i);
  const stops = found.map((f) => (f.g ? { name: f.g[0], lat: f.g[1], lng: f.g[2], country_code: f.g[3], date: null } : { name: f.name, lat: null, lng: null, country_code: null, date: null }));
  for (const s of stops) if (!hasLocation(s)) warnings.push(`Could not find "${s.name}". Pick it on the map.`);
  // Never invent dates: only a date with an explicit day is used. Otherwise stops stay
  // empty and the card shows an amber "no date" warning on each.
  const date = explicitDate(t);
  if (date) stops.forEach((s) => { s.date = date; });
  const legs = [];
  const flewFromAirport = AIRPORT_RE.test(t) && /\b(flew|flight|fly)\b/.test(low);
  const modes = MODE_WORDS.filter(([, r]) => r.test(low)).map(([mode]) => mode).filter((mode) => !(flewFromAirport && mode === "fly"));
  for (let i = 0; i + 1 < stops.length; i++) {
    const mode = modes[Math.min(i, modes.length - 1)] || "other";
    legs.push({ mode, from_stop: i, to_stop: i + 1, date, from_label: null, to_label: null, guessed: true });
    if (!modes.length) warnings.push(`Leg ${i + 1}: how you traveled from ${stops[i].name} to ${stops[i + 1].name} is a guess.`);
  }
  if (!stops.length) warnings.push("No places found. Add stops below.");
  const yr = low.match(/\b(?:19|20)\d{2}\b/)?.[0];
  const title = stops.length ? `${stops.map((s) => s.name).slice(0, 3).join(", ")}${yr ? ` ${yr}` : ""}` : "New trip";
  return normalizeDraft({ journey: { title, date_start: date, date_end: date }, stops, legs, warnings });
}
