// Client calls for the trip draft flow. Parse never writes. Save is one atomic RPC.
import { supabase } from "../supabase/client";
import { normalizeDraft, stubParse, toRpcDraft } from "./draft";

export const stubParseOn = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("stubparse") === "1";

// Returns { draft, stub } or { error, message }. Falls back to the stub parser when
// ?stubparse=1 is set or the route says the AI gateway is not configured.
export async function parseTrip(text, { signal } = {}) {
  if (stubParseOn()) return { draft: stubParse(text), stub: true };
  let res, body;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || "";
    res = await fetch("/api/parse-trip", { method: "POST", signal, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ text }) });
    body = await res.json().catch(() => ({}));
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    return { error: "network", message: "Could not reach the trip reader. Check your connection and try again." };
  }
  if (res.ok && body?.draft) return { draft: normalizeDraft(body.draft), stub: false };
  if (body?.error === "not_configured") return { draft: stubParse(text), stub: true };
  if (res.status === 429) return { error: "daily_limit", message: "You have read a lot of trips today. Try again tomorrow, or build this one step by step." };
  return { error: body?.error || "parse_failed", message: body?.message || "Could not read that trip. Try rephrasing, or build it step by step." };
}

// Atomic save. Returns { id } or { error }.
export async function saveDraft(draft) {
  const { data, error } = await supabase.rpc("create_journey_from_draft", { draft: toRpcDraft(draft) });
  if (error) return { error: error.message || "save_failed" };
  return { id: data };
}
