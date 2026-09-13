"use client";

import { formatJourneyDates } from "../../lib/journeys/format";

/**
 * Top-level journey list for Travel Journals.
 * Selecting a journey drills into its places (pins).
 */
export default function JourneyList({ journeys, onSelectJourney }) {
  return (
    <>
      <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
        Journeys
      </h2>
      <p style={{ fontSize: "0.85rem", color: "#4b5563", margin: 0, flexShrink: 0 }}>
        Your trips and collections. Open one to see its places.
      </p>

      <div className="sidebar-scrollbar" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem", overflowY: "auto", paddingRight: "0.5rem" }}>
        {(journeys || []).map((journey) => {
          const placeCount = journey.places?.length || 0;
          const dates = formatJourneyDates(journey);
          return (
            <div
              key={journey.id}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "1rem",
                cursor: "pointer",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.05)",
                background: "rgba(0,0,0,0.02)",
                transition: "all 0.2s ease",
              }}
              onClick={() => onSelectJourney(journey)}
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
            >
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {dates || "Undated"}
              </div>
              <div style={{ fontSize: "1.1rem", color: "#111827", fontWeight: 600, margin: "0.25rem 0" }}>
                {journey.title}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#4b5563", lineHeight: 1.4 }}>
                {placeCount} {placeCount === 1 ? "place" : "places"}
              </div>
            </div>
          );
        })}
        {(journeys || []).length === 0 && (
          <div style={{ textAlign: "center", color: "#4b5563", fontSize: "0.9rem", padding: "2rem 0" }}>
            No journeys yet. Add a memory pin to the globe!
          </div>
        )}
      </div>
    </>
  );
}
