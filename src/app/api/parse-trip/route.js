// POST /api/parse-trip
// Parses free text into a trip draft. Never writes trip data. The client shows the draft
// and only Save calls the create_journey_from_draft RPC.
// Auth: the app keeps its Supabase session in the browser, so the client sends the access
// token as "Authorization: Bearer <token>" and this route makes a per-request client with it
// (RLS and auth.uid() apply as that user).
import { generateObject } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LEG_MODES } from "../../../lib/draft/draft";

export const runtime = "nodejs";
export const maxDuration = 30;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

const DraftSchema = z.object({
  journey: z.object({ title: z.string().min(1), date_start: isoDate, date_end: isoDate }),
  stops: z.array(z.object({
    name: z.string().min(1),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    country_code: z.string().length(2).nullable(),
    date: isoDate,
  })).min(1),
  legs: z.array(z.object({
    mode: z.enum(LEG_MODES),
    from_stop: z.number().int().min(0),
    to_stop: z.number().int().min(0),
    date: isoDate,
    from_label: z.string().nullable(),
    to_label: z.string().nullable(),
  })),
  warnings: z.array(z.string()),
});

// The AI Gateway needs a key (or a Vercel OIDC token on a deployment with the gateway on).
function gatewayConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

const fail = (error, status, message) => NextResponse.json({ error, message }, { status });

export async function POST(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return fail("unauthorized", 401, "Please sign in again.");
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData } = await supabase.auth.getUser(token);
  if (!userData?.user) return fail("unauthorized", 401, "Please sign in again.");

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 4000) return fail("bad_request", 400, "Type your trip in up to 4000 characters.");

  // Checked before the usage bump so an unconfigured gateway never spends the daily cap.
  if (!gatewayConfigured()) return fail("not_configured", 503, "Trip parsing is not set up yet.");

  const { error: bumpError } = await supabase.rpc("ai_usage_bump", { p_limit: 20 });
  if (bumpError) {
    if (bumpError.message?.includes("daily_limit")) return fail("daily_limit", 429, "You have reached today's limit. Try again tomorrow.");
    return fail("usage_check_failed", 500, "Could not check today's usage. Try again.");
  }

  try {
    const { object } = await generateObject({
      model: "anthropic/claude-haiku-4.5", // AI Gateway plain model string
      schema: DraftSchema,
      system:
        "Extract a travel itinerary from the user text. Return place names as stops in travel order, " +
        "with your best-estimate lat/lng and ISO-3166 alpha-2 country_code. from_stop/to_stop are 0-based " +
        `indexes into stops. Leg mode must be one of: ${LEG_MODES.join(", ")} (use "fly" for flights). ` +
        "For flights put the airport in from_label/to_label, like \"New York (JFK)\", else null. " +
        "Dates are YYYY-MM-DD or null. Put any ambiguity in warnings.",
      prompt: text,
    });

    const n = object.stops.length;
    const warnings = [...object.warnings, "Coordinates were estimated. Check each stop on the map before saving."];
    const legs = object.legs.filter((l) => {
      const ok = l.from_stop < n && l.to_stop < n && l.from_stop !== l.to_stop;
      if (!ok) warnings.push(`Dropped a leg with an invalid stop index (${l.from_stop} to ${l.to_stop}).`);
      return ok;
    });
    const stops = object.stops.map((s) => ({ ...s, matched_pin_id: null }));
    return NextResponse.json({ draft: { journey: object.journey, stops, legs, warnings } });
  } catch (e) {
    console.error("parse-trip failed", e?.message || e);
    const msg = String(e?.message || "");
    if (/api key|unauthori[sz]ed|authentication|credit card|gateway/i.test(msg) && /key|auth|token|card/i.test(msg)) {
      return fail("not_configured", 503, "Trip parsing is not set up yet.");
    }
    return fail("parse_failed", 502, "Could not read that trip. Try rephrasing, or build it step by step.");
  }
}
