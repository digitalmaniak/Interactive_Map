// POST /api/parse-trip
// Parses free text into a trip draft. Never writes trip data. The client shows the draft
// and only Save calls the create_journey_from_draft RPC.
// Auth: the app keeps its Supabase session in the browser, so the client sends the access
// token as "Authorization: Bearer <token>" and this route makes a per-request client with it
// (RLS and auth.uid() apply as that user).
import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LEG_MODES, dayStated, monthOnlyJourneyDates } from "../../../lib/draft/draft";
import { monthBounds } from "../../../lib/dates/calendar";

export const runtime = "nodejs";
export const maxDuration = 30;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

const DraftSchema = z.object({
  journey: z.object({ title: z.string().min(1), date_start: isoDate, date_end: isoDate, month_only: z.string().regex(/^\d{4}-\d{2}$/).nullable() }),
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
    from_label: z.string().nullable().optional(),
    to_label: z.string().nullable().optional(),
  })),
  warnings: z.array(z.string()),
});

// Model source. First choice: Anthropic directly when ANTHROPIC_API_KEY is set.
// Second: the AI Gateway (a key, or a Vercel OIDC token on a deployment with it on).
// The key is only handed to the provider; it is never logged or returned.
function pickModel() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) return { source: "anthropic", model: createAnthropic({ apiKey: key })("claude-haiku-4-5") };
  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) return { source: "gateway", model: "anthropic/claude-haiku-4.5" };
  return null;
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

  // Checked before the usage bump so an unconfigured model never spends the daily cap.
  const picked = pickModel();
  if (!picked) return fail("not_configured", 503, "Trip parsing is not set up yet.");

  const { error: bumpError } = await supabase.rpc("ai_usage_bump", { p_limit: 20 });
  if (bumpError) {
    if (bumpError.message?.includes("daily_limit")) return fail("daily_limit", 429, "You have reached today's limit. Try again tomorrow.");
    return fail("usage_check_failed", 500, "Could not check today's usage. Try again.");
  }

  try {
    const { object } = await generateObject({
      model: picked.model,
      schema: DraftSchema,
      system:
        "Extract a travel itinerary from the user text. Return place names as stops in travel order, " +
        "with your best-estimate lat/lng and ISO-3166 alpha-2 country_code. from_stop/to_stop are 0-based " +
        `indexes into stops. Leg mode must be one of: ${LEG_MODES.join(", ")} (use "fly" for flights). ` +
        "For flights put the airport in from_label/to_label, like \"New York (JFK)\", else null. " +
        "Dates are YYYY-MM-DD or null. Never invent a date: give a date only when the text states the exact day, " +
        "otherwise null (a month or a year alone is null). When the text names only a month for the trip, like \"June 2025\", " +
        "set journey.month_only to \"YYYY-MM\" (else null) and leave every date null. Put any ambiguity in warnings.",
      prompt: text,
    });

    const n = object.stops.length;
    const warnings = [...object.warnings, "Coordinates were estimated. Check each stop on the map before saving."];
    const legs = object.legs.filter((l) => {
      const ok = l.from_stop < n && l.to_stop < n && l.from_stop !== l.to_stop;
      if (!ok) warnings.push(`Dropped a leg with an invalid stop index (${l.from_stop} to ${l.to_stop}).`);
      return ok;
    });
    // Never invent dates: drop any date whose day the text does not state.
    const keep = (d) => (d && dayStated(text, d) ? d : null);
    const stops = object.stops.map((s) => ({ ...s, date: keep(s.date), matched_pin_id: null }));
    const { month_only: mo, ...jr } = object.journey;
    let journey = { ...jr, date_start: keep(jr.date_start), date_end: keep(jr.date_end), date_precision: "day" };
    // Month only: the trip spans the month (estimated). Stops stay undated and fall back to it.
    if (!journey.date_start && !journey.date_end) {
      const fromModel = mo && /^\d{4}-(0[1-9]|1[0-2])$/.test(mo) ? (() => { const b = monthBounds(Number(mo.slice(0, 4)), Number(mo.slice(5))); return { date_start: b.start, date_end: b.end, date_precision: "month" }; })() : null;
      const month = monthOnlyJourneyDates(text) || fromModel;
      if (month) journey = { ...journey, ...month };
    }
    return NextResponse.json({ draft: { journey, stops, legs: legs.map((l) => ({ ...l, date: keep(l.date) })), warnings }, source: picked.source });
  } catch (e) {
    console.error("parse-trip failed", picked.source, e?.name || "error", e?.statusCode || "");
    const msg = String(e?.message || "");
    if (/api key|unauthori[sz]ed|authentication|credit card|gateway/i.test(msg) && /key|auth|token|card/i.test(msg)) {
      return fail("not_configured", 503, "Trip parsing is not set up yet.");
    }
    return fail("parse_failed", 502, "Could not read that trip. Try rephrasing, or build it step by step.");
  }
}
