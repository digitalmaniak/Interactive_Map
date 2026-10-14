// Server and edge read of an unlisted trip for metadata and the OG card. Anon key plus the
// x-share-token header, same RLS as the share page. Never the service key.
const JOURNEY = "id,title,date_start,date_end";
const PIN = "id,location_name,title,latitude,longitude,start_date,sort_order";
const LEG = "id,from_pin_id,from_label,from_lat,from_lng,to_pin_id,to_label,to_lat,to_lng,mode,depart_at,sort_order";

import { isMissingRpc, labelSnapped } from "./sharedLegsRpc.js";

async function legsFor(base, key, token, journeyId) {
  // RPC first; the direct read only when the function does not exist yet.
  try {
    const res = await fetch(`${base}/rest/v1/rpc/get_shared_legs`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "x-share-token": token, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }), cache: "no-store",
    });
    if (res.ok) { const rows = await res.json(); return Array.isArray(rows) ? rows.map(labelSnapped) : []; }
    const err = await res.json().catch(() => ({}));
    if (!isMissingRpc(err, res.status)) return [];
  } catch { /* fall through to the direct read */ }
  const id = encodeURIComponent(journeyId);
  const rows = await get(base, key, token, `journey_legs?select=${LEG}&journey_id=eq.${id}&deleted_at=is.null&order=sort_order.asc`);
  return Array.isArray(rows) ? rows : [];
}

async function get(base, key, token, path) {
  const res = await fetch(`${base}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, "x-share-token": token, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

/** { journey, pins, legs } or null when the trip is private, deleted or missing. */
export async function fetchSharedTrip(shareToken) {
  const token = String(shareToken || "").trim();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !base || !key || !/^[A-Za-z0-9_-]{6,128}$/.test(token)) return null;
  const t = encodeURIComponent(token);
  try {
    const rows = await get(base, key, token, `journeys?select=${JOURNEY}&share_token=eq.${t}&visibility=eq.unlisted&deleted_at=is.null&limit=1`);
    const journey = Array.isArray(rows) ? rows[0] : null;
    if (!journey) return null;
    const id = encodeURIComponent(journey.id);
    const [pins, legs] = await Promise.all([
      get(base, key, token, `pins?select=${PIN}&journey_id=eq.${id}&deleted_at=is.null&order=sort_order.asc`),
      legsFor(base, key, token, journey.id),
    ]);
    return { journey, pins: Array.isArray(pins) ? pins : [], legs };
  } catch {
    return null;
  }
}
