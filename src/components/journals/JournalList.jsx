"use client";

import { formatPinDate, sortPinsByStartDate } from "../../lib/pins/format";

/**
 * Chronological list of all travel journal pins.
 * Presentational — selection/fly-to handlers from MapCanvas via JournalsPanel.
 */
export default function JournalList({ pins, onSelectPin }) {
  return (
    <>
      <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 600, color: "var(--v2-text)", display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
        Travel Journals
      </h2>
      <p style={{ fontSize: "0.85rem", color: "var(--v2-text-dim)", margin: 0, flexShrink: 0 }}>
        Chronological history of your adventures.
      </p>

      <div className="sidebar-scrollbar" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem", overflowY: "auto", paddingRight: "0.5rem" }}>
        {sortPinsByStartDate(pins).map((pin) => (
          <div
            key={pin.id}
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "1rem",
              cursor: "pointer",
              borderRadius: "2px",
              border: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(255,255,255,0.02)",
              transition: "all 0.2s ease"
            }}
            onClick={() => onSelectPin(pin)}
            onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--v2-text-dim)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "var(--v2-mono)" }}>
              {formatPinDate(pin.start_date) || "Undated"}
            </div>
            <div style={{ fontSize: "1.1rem", color: "var(--v2-text)", fontWeight: 600, margin: "0.25rem 0" }}>
              {pin.title || pin.location_name}
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--v2-text-dim)", lineHeight: 1.4 }}>
              {pin.title ? pin.location_name : null}
            </div>
          </div>
        ))}
        {pins.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--v2-text-dim)", fontSize: "0.9rem", padding: "2rem 0" }}>
            No travel journals yet. Add a memory pin to the globe!
          </div>
        )}
      </div>
    </>
  );
}
