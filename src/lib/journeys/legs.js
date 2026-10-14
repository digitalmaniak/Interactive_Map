import { supabase } from "../supabase/client";

// Trip legs (journey_legs, owner only RLS). Harbor generates draft legs; the
// owner reviews modes and confirms the whole trip via confirm_journey_legs.
export const LEG_MODES = ["fly", "drive", "train", "boat", "cruise", "walk", "other"];

const LEG_COLUMNS =
  "id, journey_id, from_pin_id, from_label, from_lat, from_lng, to_pin_id, to_label, to_lat, to_lng, mode, depart_at, arrive_at, sort_order, status, distance_km, from_country, to_country";

/** { [journey_id]: draftCount } for the signed in user. */
export async function fetchDraftLegCounts() {
  const { data, error } = await supabase
    .from("journey_legs")
    .select("journey_id")
    .eq("status", "draft")
    .is("deleted_at", null);
  if (error) throw error;
  const counts = {};
  for (const row of data || []) counts[row.journey_id] = (counts[row.journey_id] || 0) + 1;
  return counts;
}

export async function fetchJourneyLegs(journeyId, signal) {
  let q = supabase
    .from("journey_legs")
    .select(LEG_COLUMNS)
    .eq("journey_id", journeyId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  if (signal && typeof q.abortSignal === "function") q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// One in-flight legs request per journey, shared by the globe and the Journals legs
// review. Each caller gets { promise, release }; when the last caller releases before the
// request settles (journal switch, unmount) the request is aborted.
const inflight = new Map();
export function sharedJourneyLegs(journeyId) {
  let e = inflight.get(journeyId);
  if (!e) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    e = { users: 0, settled: false, controller };
    e.promise = fetchJourneyLegs(journeyId, controller?.signal).finally(() => {
      e.settled = true;
      if (inflight.get(journeyId) === e) inflight.delete(journeyId);
    });
    inflight.set(journeyId, e);
  }
  e.users++;
  let released = false;
  return {
    promise: e.promise,
    release() {
      if (released) return;
      released = true;
      e.users--;
      if (e.users <= 0 && !e.settled) {
        e.controller?.abort();
        if (inflight.get(journeyId) === e) inflight.delete(journeyId);
      }
    },
  };
}

/** Owner insert (journey_legs_owner_all). user_id defaults to auth.uid(). */
export async function insertJourneyLeg(row) {
  if (!row) return { data: null, error: { message: "No leg." } };
  return supabase.from("journey_legs").insert(row).select(LEG_COLUMNS).single();
}

export async function updateLegMode(legId, mode) {
  if (!LEG_MODES.includes(mode)) throw new Error("Unknown mode");
  const { error } = await supabase.from("journey_legs").update({ mode }).eq("id", legId);
  if (error) throw error;
}

export async function confirmJourneyLegs(journeyId) {
  const { data, error } = await supabase.rpc("confirm_journey_legs", { p_journey: journeyId });
  if (error) throw error;
  return data;
}
