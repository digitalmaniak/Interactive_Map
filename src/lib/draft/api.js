// Client calls for the trip draft flow. Parse never writes. Save is one atomic RPC.
import { supabase } from "../supabase/client";
import { hasLocation, normalizeDraft, stubParse, toRpcDraft } from "./draft";
import { geocode, makeRateGate } from "../geocode/quickAdd";

export const stubParseOn = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("stubparse") === "1";

// Returns { draft, stub, reason } or { error, message }. Falls back to the offline reader
// when ?stubparse=1 is set, no model is configured, or the daily AI limit is reached.
export async function parseTrip(text, { signal } = {}) {
  if (stubParseOn()) return { draft: await locateStubStops(stubParse(text), { signal }), stub: true };
  let res, body;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || "";
    res = await fetch("/api/parse-trip", { method: "POST", signal, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ text }) });
    body = await res.json().catch(() => ({}));
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    return { error: "network", message: "Could not reach the trip reader. Check your connection and try again." };
  }
  if (res.ok && body?.draft) return { draft: normalizeDraft(body.draft), stub: false, reason: null };
  if (body?.error === "not_configured") return { draft: await locateStubStops(stubParse(text), { signal }), stub: true, reason: "not_configured" };
  // Daily AI cap reached: fall back to the offline reader and say why.
  if (res.status === 429 || body?.error === "daily_limit") return { draft: await locateStubStops(stubParse(text), { signal }), stub: true, reason: "daily_limit" };
  return { error: body?.error || "parse_failed", message: body?.message || "Could not read that trip. Try rephrasing, or build it step by step." };
}

// Stub fallback: stops the small gazetteer does not know go through the quick add
// geocoder (Photon, then Nominatim, one request a second). A hit is placed and marked
// guessed (amber) with a warning to check it. A miss stays unlocated for the place search.
export async function locateStubStops(draft, { signal, geocodeImpl = geocode } = {}) {
  const gate = makeRateGate();
  const stops = [...draft.stops];
  let warnings = [...draft.warnings];
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    if (hasLocation(s) || !s.name) continue;
    try {
      const hit = (await geocodeImpl(s.name, { signal, gate }))?.results?.[0];
      if (!hit) continue;
      stops[i] = { ...s, lat: Number(hit.lat), lng: Number(hit.lng), country_code: hit.countryCode || null, guessed: true };
      warnings = warnings.filter((w) => w !== `Could not find "${s.name}". Pick it on the map.`);
      warnings.push(`"${s.name}" was placed by a guess${hit.country ? ` in ${hit.country}` : ""}. Check it on the map.`);
    } catch (e) {
      if (e?.name === "AbortError") throw e;
    }
  }
  return normalizeDraft({ ...draft, stops, warnings });
}

// Atomic save. Returns { id } or { error }.
export async function saveDraft(draft) {
  const { data, error } = await supabase.rpc("create_journey_from_draft", { draft: toRpcDraft(draft) });
  if (error) return { error: error.message || "save_failed" };
  return { id: data };
}
