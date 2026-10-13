import { supabase } from "./supabase/client";

// Dated home bases (profile_home_bases, owner only RLS). Read only.
export async function fetchHomeBases() {
  const { data, error } = await supabase
    .from("profile_home_bases")
    .select("label, lat, lng, valid_from, valid_to")
    .order("valid_from", { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data || [];
}
