// "Part of a trip?" helpers for the Add entry form. Pure, no network.
export const TRIP_CHOICES = ["new", "trip", "place"];
export const JOIN_MODES = ["fly", "drive", "train", "boat", "walk", "other"];

/** Local calendar date as YYYY-MM-DD. Never toISOString, which is UTC. */
export function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Default choice: inside an open trip, add to it. Elsewhere, just a place. */
export function defaultChoice(inTripId) {
  return inTripId ? "trip" : "place";
}

/** Real trips for the dropdown, most recent first. Skips Imported and collections. */
export function tripOptions(journeys) {
  const t = (j) => Date.parse(j.updated_at || j.created_at || j.date_start || 0) || 0;
  return (journeys || [])
    .filter((j) => j?.id && j.title !== "Imported" && !String(j.id).startsWith("__") && !j.deleted_at)
    .sort((a, b) => t(b) - t(a));
}

/** Last stop of a trip: highest sort_order, then latest start_date, then latest created_at. */
export function lastStop(pins, journeyId) {
  const list = (pins || []).filter((p) => p.journey_id === journeyId && !p.deleted_at);
  if (!list.length) return null;
  const key = (p) => [p.sort_order ?? 0, p.start_date || "", p.created_at || ""];
  return list.reduce((best, p) => {
    const a = key(p), b = key(best);
    for (let i = 0; i < 3; i++) { if (a[i] > b[i]) return p; if (a[i] < b[i]) return best; }
    return best;
  });
}

/** Next pin sort_order inside a trip. */
export function nextPinSort(pins, journeyId) {
  const list = (pins || []).filter((p) => p.journey_id === journeyId && !p.deleted_at);
  return list.length ? Math.max(...list.map((p) => p.sort_order ?? 0)) + 1 : 0;
}

/** journey_legs row from the trip's last stop to the new pin. Null when no last stop. */
export function joinLegRow({ journeyId, from, toPinId, mode, sortOrder }) {
  if (!journeyId || !from?.id || !toPinId) return null;
  return {
    journey_id: journeyId,
    from_pin_id: from.id,
    to_pin_id: toPinId,
    mode: JOIN_MODES.includes(mode) ? mode : "other",
    status: "confirmed",
    sort_order: sortOrder ?? 0,
  };
}

/** Preview leg row for the globe (dashed, 40%), from the last stop to the picked place. */
export function previewLegRow(from, coords, mode) {
  const lat = Number(coords?.lat), lng = Number(coords?.lon);
  if (!from || !Number.isFinite(lat) || !Number.isFinite(lng) || !mode) return null;
  return {
    id: "preview:join", from_pin_id: null, to_pin_id: null,
    from_lat: Number(from.latitude), from_lng: Number(from.longitude), to_lat: lat, to_lng: lng,
    from_label: null, to_label: null, mode, status: "draft", sort_order: 0, depart_at: null, arrive_at: null,
  };
}

/** Empty dates save as null (Undated). */
export const dateOrNull = (v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
