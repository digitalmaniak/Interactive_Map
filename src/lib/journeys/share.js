/**
 * Public unlisted journey load via Harbor share_token + x-share-token header.
 * No dedicated Harbor RPC — uses existing unlisted SELECT policies.
 */
import { createShareClient } from "../supabase/shareClient";

const SHARED_JOURNEY_SELECT =
  "id, title, summary, date_start, date_end, visibility, tags, share_token, created_at, updated_at";

const SHARED_PLACE_SELECT =
  "id, title, location_name, latitude, longitude, start_date, end_date, journey_id, sort_order, trip_type";

/** App Router path for an unlisted journey share link. */
export function journeySharePath(token) {
  return `/share/${token}`;
}

/** Absolute share URL when running in the browser; otherwise the path. */
export function journeyShareUrl(token) {
  const path = journeySharePath(token);
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

/** True when the journey is live-shared (DB visibility unlisted + token). */
export function isJourneyShared(journey) {
  return Boolean(journey && journey.visibility === "unlisted" && journey.share_token);
}

/**
 * Copy the live `/share/[token]` URL.
 * Falls back to a prompt if the clipboard API is blocked.
 */
export async function copyJourneyShareUrl(token) {
  if (!token) return { ok: false, url: null };
  const url = journeyShareUrl(token);
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return { ok: true, url };
    }
  } catch (err) {
    console.error(err);
  }
  if (typeof window !== "undefined") {
    window.prompt("Copy share link:", url);
  }
  return { ok: false, url };
}

/**
 * Load one unlisted journey + its places for anonymous viewers.
 * Client must send x-share-token matching journeys.share_token (Harbor RLS).
 */
export async function loadSharedJourney(shareToken) {
  const token = String(shareToken || "").trim();
  if (!token) {
    return { data: null, error: { message: "Share token is required." } };
  }

  const client = createShareClient(token);

  const { data: journey, error: journeyError } = await client
    .from("journeys")
    .select(SHARED_JOURNEY_SELECT)
    .eq("share_token", token)
    .eq("visibility", "unlisted")
    .is("deleted_at", null)
    .maybeSingle();

  if (journeyError) return { data: null, error: journeyError };
  if (!journey) {
    return {
      data: null,
      error: { message: "This journey is private or the link is invalid." },
    };
  }

  const { data: places, error: placesError } = await client
    .from("pins")
    .select(SHARED_PLACE_SELECT)
    .eq("journey_id", journey.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (placesError) return { data: null, error: placesError };

  return {
    data: { ...journey, places: places || [] },
    error: null,
  };
}
