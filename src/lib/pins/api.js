/**
 * Pin / pin_logs Supabase CRUD extracted from MapCanvas.
 * Behavior-identical wrappers around the prior inline queries.
 * Keeps table names `pins` / `pin_logs` (no schema renames).
 */
import { supabase } from "../supabase/client";

/** Select all non-deleted pins with nested pin_logs; maps pin_logs → logs. */
export async function loadPins() {
  const { data, error } = await supabase
    .from("pins")
    .select("*, pin_logs(*)")
    .is("deleted_at", null);
  if (error) return { data: null, error };
  if (!data) return { data: null, error: null };
  const mapped = data.map((pin) => ({
    ...pin,
    logs: pin.pin_logs || [],
  }));
  return { data: mapped, error: null };
}

/** Insert a pin row; returns the inserted row via .select().single(). */
export async function addPin(fields) {
  const { data, error } = await supabase
    .from("pins")
    .insert(fields)
    .select()
    .single();
  return { data, error };
}

/** Update a pin by id; returns the updated row via .select().single(). */
export async function updatePin(id, fields) {
  const { data, error } = await supabase
    .from("pins")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  return { data, error };
}

/** Delete a pin by id. */
export async function removePin(id) {
  const { error } = await supabase.from("pins").delete().eq("id", id);
  return { error };
}

/** Insert a single pin_logs row; returns the inserted row via .select().single(). */
export async function addLog(fields) {
  const { data, error } = await supabase
    .from("pin_logs")
    .insert(fields)
    .select()
    .single();
  return { data, error };
}

/** Bulk-insert pin_logs rows (no .select()); used by local→Supabase migrate. */
export async function addLogs(rows) {
  const { data, error } = await supabase.from("pin_logs").insert(rows);
  return { data, error };
}

/** Update a pin_logs row by id; returns the updated row via .select().single(). */
export async function updateLog(id, fields) {
  const { data, error } = await supabase
    .from("pin_logs")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  return { data, error };
}

/** Delete a pin_logs row by id. */
export async function removeLog(id) {
  const { error } = await supabase.from("pin_logs").delete().eq("id", id);
  return { error };
}
