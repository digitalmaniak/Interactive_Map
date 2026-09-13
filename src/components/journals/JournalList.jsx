"use client";

import { formatPinDate, sortPinsByStartDate } from "../../lib/pins/format";

/**
 * Chronological list of all travel journal pins.
 * Presentational — selection/fly-to handlers from MapCanvas via JournalsPanel.
 */
export default function JournalList({ pins, onSelectPin }) {
  return (
    <>
      <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
        Travel Journals
      </h2>
      <p style={{ fontSize: "0.85rem", color: "#4b5563", margin: 0, flexShrink: 0 }}>
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
              borderRadius: "8px",
              border: "1px solid rgba(0,0,0,0.05)",
              background: "rgba(0,0,0,0.02)",
              transition: "all 0.2s ease"
            }}
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
        {pins.length === 0 && (
          <div style={{ textAlign: "center", color: "#4b5563", fontSize: "0.9rem", padding: "2rem 0" }}>
            No travel journals yet. Add a memory pin to the globe!
          </div>
        )}
      </div>
    </>
  );
}
