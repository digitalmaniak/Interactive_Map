"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatJourneyDates } from "../../../lib/journeys/format";
import { formatPinDate, sortPinsByStartDate } from "../../../lib/pins/format";
import { loadSharedJourney } from "../../../lib/journeys/share";

/**
 * Public read-only unlisted journey view.
 * Loads via Harbor share_token + x-share-token header (anon). No edit, no map, no auth.
 */
export default function SharedJourneyPage() {
  const params = useParams();
  const token = typeof params?.token === "string" ? params.token : Array.isArray(params?.token) ? params.token[0] : "";
  const [journey, setJourney] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      setJourney(null);
      if (!token) {
        setError("Missing share token.");
        setLoading(false);
        return;
      }
      const { data, error: loadError } = await loadSharedJourney(token);
      if (cancelled) return;
      if (loadError || !data) {
        setError(loadError?.message || "Journey not found.");
        setLoading(false);
        return;
      }
      setJourney(data);
      setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const places = sortPinsByStartDate(journey?.places || []);
  const dates = formatJourneyDates(journey);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        color: "#111827",
        padding: "2rem 1rem 3rem",
      }}
    >
      <div
        style={{
          maxWidth: "640px",
          margin: "0 auto",
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(15,23,42,0.08)",
          borderRadius: "16px",
          boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
          padding: "1.5rem",
        }}
      >
        <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.75rem" }}>
          Shared journey · Read only
        </div>

        {loading && (
          <p style={{ color: "#4b5563", margin: 0 }}>Loading journey…</p>
        )}

        {!loading && error && (
          <div>
            <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>Unavailable</h1>
            <p style={{ color: "#4b5563", margin: 0 }}>{error}</p>
          </div>
        )}

        {!loading && !error && journey && (
          <>
            <h1 style={{ fontSize: "1.75rem", margin: "0 0 0.35rem", fontWeight: 700 }}>
              {journey.title}
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#4b5563", margin: "0 0 1rem" }}>
              {dates ? `${dates} · ` : ""}
              {places.length} {places.length === 1 ? "place" : "places"}
            </p>
            {journey.summary && (
              <p style={{ fontSize: "1rem", lineHeight: 1.55, color: "#1f2937", margin: "0 0 1.25rem" }}>
                {journey.summary}
              </p>
            )}
            {Array.isArray(journey.tags) && journey.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1.25rem" }}>
                {journey.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "#1d4ed8",
                      background: "rgba(37,99,235,0.08)",
                      border: "1px solid rgba(37,99,235,0.2)",
                      borderRadius: "999px",
                      padding: "0.25rem 0.6rem",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem", fontWeight: 700 }}>Places</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {places.map((pin) => (
                <div
                  key={pin.id}
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: "10px",
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "rgba(248,250,252,0.9)",
                  }}
                >
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b" }}>
                    {formatPinDate(pin.start_date) || "Undated"}
                  </div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 600, marginTop: "0.2rem" }}>
                    {pin.location_name || "Untitled place"}
                  </div>
                  {pin.title && (
                    <div style={{ fontSize: "0.9rem", color: "#4b5563", marginTop: "0.15rem" }}>
                      {pin.title}
                    </div>
                  )}
                </div>
              ))}
              {places.length === 0 && (
                <p style={{ color: "#4b5563", margin: 0 }}>No places in this journey.</p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
