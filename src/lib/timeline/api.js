import { supabase } from "../supabase/client";

// One row per live trip with first/last dates (journey_stats_v2, RLS owner rows).
export async function fetchTripRanges(signal) {
  let q = supabase.from("journey_stats_v2").select("journey_id, first_date, last_date, stop_count");
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  return { rows: data || [], error };
}

// Undated stop count for the strip chip (data_review_items, kind undated_stop).
export async function fetchUndatedCount(signal) {
  let q = supabase.from("data_review_items").select("item_id").eq("kind", "undated_stop");
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  return { count: (data || []).length, error };
}
