// Travel stats: one read of Harbor's profile_stats_v2 view (security_invoker, so RLS
// scopes it to the signed-in user; soft-deleted journeys, legs and pins are excluded there).
import { supabase } from "../supabase/client";

export const STATS_COLUMNS = "country_count, journey_count, total_km, flown_km";

export async function fetchProfileStats() {
  const { data, error } = await supabase.from("profile_stats_v2").select(STATS_COLUMNS).maybeSingle();
  if (error) return { data: null, error };
  return { data: toStats(data), error: null };
}

/** View row to display values. Missing row (no trips yet) reads as zeros. */
export function toStats(row) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return { countries: n(row?.country_count), trips: n(row?.journey_count), km: Math.round(n(row?.total_km)), flownKm: Math.round(n(row?.flown_km)) };
}
