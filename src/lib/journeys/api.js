/**
 * Journey read/write helpers for Harbor `journeys` table.
 * Owner-scoped via RLS; soft-deleted rows excluded on load.
 * Owner can flip visibility private↔unlisted; public read uses share.js + x-share-token.
 */
import { supabase } from "../supabase/client";
import { updatePin } from "../pins/api";

const JOURNEY_SELECT =
  "id, user_id, title, summary, date_start, date_end, visibility, share_token, tags, created_at, updated_at";

/** Select non-deleted journeys for the signed-in user (RLS). */
export async function loadJourneys() {
  const { data, error } = await supabase
    .from("journeys")
    .select(JOURNEY_SELECT)
    .is("deleted_at", null)
    .order("date_start", { ascending: false });
  if (error) return { data: null, error };
  return { data: data || [], error: null };
}

/**
 * Create a journey. Title required; dates/tags optional.
 * Visibility defaults to `private` (DB default).
 */
export async function createJourney({ userId, title, summary, date_start, date_end, tags }) {
  const trimmed = (title || "").trim();
  if (!trimmed) {
    return { data: null, error: { message: "Title is required." } };
  }
  if (!userId) {
    return { data: null, error: { message: "user_id is required." } };
  }
  const row = {
    user_id: userId,
    title: trimmed,
    summary: summary?.trim() || null,
    date_start: date_start || null,
    date_end: date_end || null,
    visibility: "private",
    tags: normalizeTags(tags),
  };
  const { data, error } = await supabase
    .from("journeys")
    .insert(row)
    .select(JOURNEY_SELECT)
    .single();
  return { data, error };
}

/** Update journey metadata (title, summary, dates, tags, visibility, share_token). */
export async function updateJourney(id, fields) {
  if (!id) return { data: null, error: { message: "Journey id is required." } };
  const patch = {};
  if (fields.title !== undefined) {
    const trimmed = (fields.title || "").trim();
    if (!trimmed) return { data: null, error: { message: "Title is required." } };
    patch.title = trimmed;
  }
  if (fields.summary !== undefined) patch.summary = fields.summary?.trim() || null;
  if (fields.date_start !== undefined) patch.date_start = fields.date_start || null;
  if (fields.date_end !== undefined) patch.date_end = fields.date_end || null;
  if (fields.tags !== undefined) patch.tags = normalizeTags(fields.tags);
  if (fields.visibility !== undefined) {
    if (fields.visibility !== "private" && fields.visibility !== "unlisted") {
      return { data: null, error: { message: "visibility must be private or unlisted." } };
    }
    patch.visibility = fields.visibility;
  }
  if (fields.share_token !== undefined) patch.share_token = fields.share_token;

  if (Object.keys(patch).length === 0) {
    return { data: null, error: { message: "No fields to update." } };
  }

  const { data, error } = await supabase
    .from("journeys")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null)
    .select(JOURNEY_SELECT)
    .single();
  return { data, error };
}

/**
 * Flip journey visibility. When becoming unlisted, ensure share_token exists
 * (Harbor column is usually already set via default gen_random_uuid()).
 * Flipping to private stops public access; token may remain unused.
 */
export async function setJourneyVisibility(id, visibility, existingShareToken) {
  if (!id) return { data: null, error: { message: "Journey id is required." } };
  if (visibility !== "private" && visibility !== "unlisted") {
    return { data: null, error: { message: "visibility must be private or unlisted." } };
  }
  const fields = { visibility };
  if (visibility === "unlisted" && !existingShareToken) {
    fields.share_token =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : null;
    if (!fields.share_token) {
      return { data: null, error: { message: "Could not generate share_token." } };
    }
  }
  return updateJourney(id, fields);
}

/**
 * Find (or create) the user's Imported catch-all journey.
 * Matches Harbor trigger semantics (title === "Imported").
 */
export async function ensureImportedJourney(userId) {
  if (!userId) return { data: null, error: { message: "user_id is required." } };

  const { data: existing, error: findError } = await supabase
    .from("journeys")
    .select(JOURNEY_SELECT)
    .eq("user_id", userId)
    .eq("title", "Imported")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (findError) return { data: null, error: findError };
  if (existing) return { data: existing, error: null };

  const { data: created, error: createError } = await supabase
    .from("journeys")
    .insert({
      user_id: userId,
      title: "Imported",
      visibility: "private",
      summary: "Soft-migrate catch-all for pins without a journey.",
    })
    .select(JOURNEY_SELECT)
    .single();
  return { data: created, error: createError };
}

/**
 * Soft-delete a journey: move its pins to Imported, then set deleted_at.
 * Does not hard-delete. Refuses to soft-delete the Imported journey itself.
 */
export async function softDeleteJourney(journey, userId) {
  if (!journey?.id) return { error: { message: "Journey id is required." } };
  if (journey.title === "Imported" || journey.id === "__client_imported__") {
    return { error: { message: "The Imported journey cannot be deleted." } };
  }
  if (String(journey.id).startsWith("__")) {
    return { error: { message: "Cannot delete a client-only journey bucket." } };
  }

  const { data: imported, error: importedError } = await ensureImportedJourney(userId);
  if (importedError || !imported) {
    return { error: importedError || { message: "Could not resolve Imported journey." } };
  }

  // Move places first so pins are not orphaned (journey_id is NOT NULL).
  const { error: moveError } = await supabase
    .from("pins")
    .update({ journey_id: imported.id, updated_at: new Date().toISOString() })
    .eq("journey_id", journey.id)
    .is("deleted_at", null);
  if (moveError) return { error: moveError };

  const { error: deleteError } = await supabase
    .from("journeys")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", journey.id)
    .is("deleted_at", null);
  if (deleteError) return { error: deleteError };

  return { error: null, importedId: imported.id };
}

/** Move a pin (place) to another journey by updating pins.journey_id. */
export async function movePinToJourney(pinId, journeyId) {
  if (!pinId) return { data: null, error: { message: "Pin id is required." } };
  if (!journeyId || String(journeyId).startsWith("__")) {
    return { data: null, error: { message: "A real journey id is required." } };
  }
  return updatePin(pinId, {
    journey_id: journeyId,
    updated_at: new Date().toISOString(),
  });
}

/** Normalize tags: array, comma-separated string, or null. */
function normalizeTags(tags) {
  if (tags == null || tags === "") return null;
  if (Array.isArray(tags)) {
    const cleaned = tags.map((t) => String(t).trim()).filter(Boolean);
    return cleaned.length ? cleaned : null;
  }
  const cleaned = String(tags)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return cleaned.length ? cleaned : null;
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
