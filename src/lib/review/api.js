import { supabase } from "../supabase/client";

// Harbor's data_review_items view (security_invoker, owner rows only):
// kind ('undated_stop' | 'draft_leg'), user_id, journey_id, item_id, label, detail (leg mode).
export async function fetchReviewItems(signal) {
  let q = supabase.from("data_review_items").select("kind, journey_id, item_id, label, detail");
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  return { items: data || [], error };
}

// confirm_review_item(p_kind, p_item_id, p_start_date, p_end_date) returns true when one
// row changed. Called only from an explicit per item confirm tap.
export async function confirmReviewItem({ kind, itemId, startDate = null, endDate = null }) {
  const { data, error } = await supabase.rpc("confirm_review_item", {
    p_kind: kind,
    p_item_id: itemId,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });
  return { changed: data === true, error };
}

export { groupReviewItems, validStopDates } from "./logic.js";
