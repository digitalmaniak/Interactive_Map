/**
 * Journey read helpers for Harbor `journeys` table.
 * Owner-scoped via RLS; soft-deleted rows excluded.
 * No share-token / unlisted UI in this slice.
 */
import { supabase } from "../supabase/client";

/** Select non-deleted journeys for the signed-in user (RLS). */
export async function loadJourneys() {
  const { data, error } = await supabase
    .from("journeys")
    .select("id, user_id, title, summary, date_start, date_end, visibility, tags, created_at, updated_at")
    .is("deleted_at", null)
    .order("date_start", { ascending: false });
  if (error) return { data: null, error };
  return { data: data || [], error: null };
}

/**
 * Attach flat pins to journey rows by journey_id.
 * Pins with null/missing journey_id go under the user's "Imported" journey
 * when present; otherwise a client-side Imported bucket (matches Harbor trigger semantics).
 * Returns journeys with a `places` array; empty journeys are kept.
 */
export function groupPinsByJourney(journeys, pins) {
  const list = (journeys || []).map((j) => ({ ...j, places: [] }));
  const byId = new Map(list.map((j) => [j.id, j]));
  const imported = list.find((j) => j.title === "Imported") || null;

  let clientImported = null;
  for (const pin of pins || []) {
    let journeyId = pin.journey_id || null;
    if (!journeyId && imported) {
      journeyId = imported.id;
    }
    if (journeyId && byId.has(journeyId)) {
      byId.get(journeyId).places.push(pin);
      continue;
    }
    if (!clientImported) {
      clientImported = {
        id: "__client_imported__",
        title: "Imported",
        summary: "Pins without a journey_id",
        date_start: null,
        date_end: null,
        visibility: "private",
        tags: null,
        places: [],
      };
    }
    clientImported.places.push(pin);
  }

  const result = [...list];
  if (clientImported) result.push(clientImported);

  // Prefer dated journeys first (desc), undated / Imported last.
  result.sort((a, b) => {
    const aImported = a.title === "Imported" ? 1 : 0;
    const bImported = b.title === "Imported" ? 1 : 0;
    if (aImported !== bImported) return aImported - bImported;
    const aT = a.date_start ? new Date(a.date_start).getTime() : -Infinity;
    const bT = b.date_start ? new Date(b.date_start).getTime() : -Infinity;
    return bT - aT;
  });

  return result;
}
