"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatJourneyDates } from "../../../lib/journeys/format";
import { formatPinDate, sortPinsByStartDate } from "../../../lib/pins/format";
import { loadSharedJourney } from "../../../lib/journeys/share";
import Crosshairs from "../../../components/shell/Crosshairs";

/**
 * Public read-only unlisted journey view.
 * Loads via Harbor share_token + x-share-token header (anon). No edit, no map, no auth.
 * Atlas Editorial light read-only surfaces — visual only.
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
      className="share-page"
      style={{
        minHeight: "100vh",
        height: "auto",
        padding: "2rem 1rem 3rem",
        overflowX: "hidden",
        overflowY: "auto",
      }}
    >
      <Crosshairs />
      <div className="v2-wordmark share-wordmark">Odyssey</div>
      <div
        className="share-card v2-panel"
        style={{
          maxWidth: "640px",
          margin: "0 auto",
          padding: "1.75rem 1.5rem",
        }}
      >
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontFamily: "var(--v2-mono)",
            color: "var(--v2-text-dim)",
            marginBottom: "0.85rem",
          }}
        >
          Shared journey · Read only
        </div>

        {loading && (
          <p style={{ color: "var(--v2-text-dim)", margin: 0 }}>Loading journey…</p>
        )}

        {!loading && error && (
          <div>
            <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.5rem", color: "var(--v2-text)", letterSpacing: "-0.02em" }}>Unavailable</h1>
            <p style={{ color: "var(--v2-text-dim)", margin: 0, lineHeight: 1.5 }}>{error}</p>
          </div>
        )}

        {!loading && !error && journey && (
          <>
            <h1 style={{ fontSize: "clamp(2.25rem, 7vw, 3.5rem)", margin: "0 0 0.5rem", fontWeight: 300, color: "var(--v2-text)", letterSpacing: "-0.03em", lineHeight: 0.95, fontFamily: "var(--v2-sans)" }}>
              {journey.title}
            </h1>
            <p style={{ fontSize: "0.75rem", color: "var(--v2-text-dim)", margin: "0 0 1rem", lineHeight: 1.45, fontFamily: "var(--v2-mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {dates ? `${dates} · ` : ""}
              {places.length} {places.length === 1 ? "place" : "places"}
            </p>
            {journey.summary && (
              <p style={{ fontSize: "1rem", lineHeight: 1.6, color: "var(--v2-text)", margin: "0 0 1.25rem" }}>
                {journey.summary}
              </p>
            )}
            {Array.isArray(journey.tags) && journey.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1.25rem" }}>
                {journey.tags.map((tag) => (
                  <span key={tag} className="editorial-chip">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem", fontWeight: 700, color: "var(--v2-text)" }}>Places</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {places.map((pin) => (
                <div
                  key={pin.id}
                  className="editorial-card"
                  style={{
                    padding: "0.95rem 1rem",
                    background: "var(--v2-surface-2)",
                  }}
                >
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "var(--v2-mono)", color: "var(--v2-text-dim)" }}>
                    {formatPinDate(pin.start_date) || "Undated"}
                  </div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 600, marginTop: "0.2rem", color: "var(--v2-text)" }}>
                    {pin.location_name || "Untitled place"}
                  </div>
                  {pin.title && (
                    <div style={{ fontSize: "0.9rem", color: "var(--v2-text-dim)", marginTop: "0.15rem", lineHeight: 1.4 }}>
                      {pin.title}
                    </div>
                  )}
                </div>
              ))}
              {places.length === 0 && (
                <p style={{ color: "var(--v2-text-dim)", margin: 0 }}>No places in this journey.</p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
