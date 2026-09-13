"use client";

import { useState } from "react";
import { formatPinDate, sortPinsByStartDate } from "../../lib/pins/format";
import { formatJourneyDates } from "../../lib/journeys/format";
import { isJourneyShared } from "../../lib/journeys/share";
import JourneyShareActions from "./JourneyShareActions";

/**
 * Places (pins) inside a selected journey.
 * Selecting a place opens PinDetail; back returns to the journey list.
 * Supports moving a place to another journey.
 * Share / Stop sharing is one-action (N1) — no "unlisted" in primary labels.
 */
export default function JourneyPlacesList({
  journey,
  journeys,
  onSelectPin,
  onBack,
  onMovePlace,
  onShareJourney,
  onStopSharingJourney,
}) {
  const places = sortPinsByStartDate(journey?.places || []);
  const dates = formatJourneyDates(journey);
  const [movingPinId, setMovingPinId] = useState(null);
  const [busy, setBusy] = useState(false);
  const shared = isJourneyShared(journey);
  const canShare =
    Boolean(onShareJourney || onStopSharingJourney) &&
    journey &&
    !String(journey.id).startsWith("__") &&
    journey.title !== "Imported";

  const moveTargets = (journeys || []).filter(
    (j) =>
      j.id !== journey?.id &&
      !String(j.id).startsWith("__")
  );

  const handleMove = async (pin, targetJourneyId) => {
    if (!onMovePlace || !targetJourneyId || busy) return;
    setBusy(true);
    try {
      const ok = await onMovePlace(pin, targetJourneyId);
      if (ok !== false) setMovingPinId(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={onBack}
        style={{ background: "transparent", border: "none", color: "#78716C", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.25rem", flexShrink: 0 }}
        onMouseOver={(e) => (e.currentTarget.style.color = "#1C1917")}
        onMouseOut={(e) => (e.currentTarget.style.color = "#78716C")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"></path><polyline points="12 19 5 12 12 5"></polyline></svg>
        All journeys
      </button>
      <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 700, color: "#1C1917", flexShrink: 0 }}>
        {journey?.title || "Journey"}
      </h2>
      <p style={{ fontSize: "0.85rem", color: "#78716C", margin: "0.25rem 0 0", flexShrink: 0 }}>
        {dates ? `${dates} · ` : ""}
        {places.length} {places.length === 1 ? "place" : "places"}
        {shared ? " · Shared" : ""}
      </p>
      {canShare && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexShrink: 0, flexWrap: "wrap" }}>
          <JourneyShareActions
            journey={journey}
            onShareJourney={onShareJourney}
            onStopSharingJourney={onStopSharingJourney}
            busy={busy}
            setBusy={setBusy}
          />
        </div>
      )}
      <div className="sidebar-scrollbar" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem", overflowY: "auto", paddingRight: "0.5rem" }}>
        {places.map((pin) => (
          <div
            key={pin.id}
            style={{ display: "flex", flexDirection: "column", padding: "1rem", cursor: "pointer", borderRadius: "12px", border: "1px solid #E7E5E4", background: "#FFFFFF", transition: "all 0.2s ease" }}
            onClick={() => onSelectPin(pin)}
            onMouseOver={(e) => { e.currentTarget.style.background = "#FAFAF8"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "#FFFFFF"; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {formatPinDate(pin.start_date) || "Undated"}
                </div>
                <div style={{ fontSize: "1.1rem", color: "#1C1917", fontWeight: 600, margin: "0.25rem 0" }}>
                  {pin.location_name}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#78716C", lineHeight: 1.4 }}>
                  {pin.title}
                </div>
              </div>
              {onMovePlace && moveTargets.length > 0 && (
                <button
                  type="button"
                  title="Move to another journey"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMovingPinId(movingPinId === pin.id ? null : pin.id);
                  }}
                  style={{ background: "transparent", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "6px", padding: "0.25rem 0.4rem", cursor: "pointer", color: "#57534E", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0 }}
                  disabled={busy}
                >
                  Move
                </button>
              )}
            </div>
            {movingPinId === pin.id && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ marginTop: "0.65rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}
              >
                <label className="panel-label" style={{ marginBottom: 0 }}>Move to journey</label>
                <select
                  className="panel-input"
                  defaultValue=""
                  disabled={busy}
                  onChange={(e) => {
                    const targetId = e.target.value;
                    if (targetId) handleMove(pin, targetId);
                  }}
                >
                  <option value="" disabled>
                    Select journey…
                  </option>
                  {moveTargets.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
        {places.length === 0 && (
          <div style={{ textAlign: "center", color: "#78716C", fontSize: "0.9rem", padding: "2rem 0" }}>
            No places in this journey yet.
          </div>
        )}
      </div>
    </>
  );
}
