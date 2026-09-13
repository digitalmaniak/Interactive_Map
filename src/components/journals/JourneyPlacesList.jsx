"use client";

import { formatPinDate, sortPinsByStartDate } from "../../lib/pins/format";
import { formatJourneyDates } from "../../lib/journeys/format";

/**
 * Places (pins) inside a selected journey.
 * Selecting a place opens PinDetail; back returns to the journey list.
 */
export default function JourneyPlacesList({ journey, onSelectPin, onBack }) {
  const places = sortPinsByStartDate(journey?.places || []);
  const dates = formatJourneyDates(journey);

  return (
    <>
      <button
        onClick={onBack}
        style={{ background: "transparent", border: "none", color: "#4b5563", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.25rem", flexShrink: 0 }}
        onMouseOver={(e) => (e.currentTarget.style.color = "#111827")}
        onMouseOut={(e) => (e.currentTarget.style.color = "#4b5563")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"></path><polyline points="12 19 5 12 12 5"></polyline></svg>
        All journeys
      </button>
      <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 700, color: "#111827", flexShrink: 0 }}>
        {journey?.title || "Journey"}
      </h2>
      <p style={{ fontSize: "0.85rem", color: "#4b5563", margin: "0.25rem 0 0", flexShrink: 0 }}>
        {dates ? `${dates} · ` : ""}
        {places.length} {places.length === 1 ? "place" : "places"}
      </p>
      <div className="sidebar-scrollbar" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem", overflowY: "auto", paddingRight: "0.5rem" }}>
        {places.map((pin) => (
          <div
            key={pin.id}
            style={{ display: "flex", flexDirection: "column", padding: "1rem", cursor: "pointer", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)", background: "rgba(0,0,0,0.02)", transition: "all 0.2s ease" }}
            onClick={() => onSelectPin(pin)}
            onMouseOver={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {formatPinDate(pin.start_date) || "Undated"}
            </div>
            <div style={{ fontSize: "1.1rem", color: "#111827", fontWeight: 600, margin: "0.25rem 0" }}>
              {pin.location_name}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#4b5563", lineHeight: 1.4 }}>
              {pin.title}
            </div>
          </div>
        ))}
        {places.length === 0 && (
          <div style={{ textAlign: "center", color: "#4b5563", fontSize: "0.9rem", padding: "2rem 0" }}>
            No places in this journey yet.
          </div>
        )}
      </div>
    </>
  );
}
