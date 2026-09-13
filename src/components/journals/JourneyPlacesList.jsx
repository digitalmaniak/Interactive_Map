"use client";

import { useState } from "react";
import { formatPinDate, sortPinsByStartDate } from "../../lib/pins/format";
import { formatJourneyDates } from "../../lib/journeys/format";
import { journeyShareUrl } from "../../lib/journeys/share";

/**
 * Places (pins) inside a selected journey.
 * Selecting a place opens PinDetail; back returns to the journey list.
 * Supports moving a place to another journey.
 * Owner can toggle unlisted visibility and copy the share URL.
 */
export default function JourneyPlacesList({
  journey,
  journeys,
  onSelectPin,
  onBack,
  onMovePlace,
  onSetVisibility,
}) {
  const places = sortPinsByStartDate(journey?.places || []);
  const dates = formatJourneyDates(journey);
  const [movingPinId, setMovingPinId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUnlisted = journey?.visibility === "unlisted";
  const canShare = Boolean(onSetVisibility) && journey && !String(journey.id).startsWith("__") && journey.title !== "Imported";

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
        {isUnlisted ? " · Unlisted" : " · Private"}
      </p>
      {canShare && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexShrink: 0, flexWrap: "wrap" }}>
          <button
            type="button"
            className="glass-pill icon-button"
            style={{ background: isUnlisted ? "rgba(0,0,0,0.05)" : "rgba(37,99,235,0.08)", border: isUnlisted ? "1px solid #ccc" : "1px solid rgba(37,99,235,0.25)", padding: "0.4rem 0.75rem", fontSize: "0.7rem", fontWeight: 700, color: isUnlisted ? "#374151" : "#1d4ed8" }}
            disabled={busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              try {
                await onSetVisibility(journey, isUnlisted ? "private" : "unlisted");
              } finally {
                setBusy(false);
              }
            }}
          >
            {isUnlisted ? "MAKE PRIVATE" : "MAKE UNLISTED"}
          </button>
          {isUnlisted && journey.share_token && (
            <button
              type="button"
              className="glass-pill icon-button"
              style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)", padding: "0.4rem 0.75rem", fontSize: "0.7rem", fontWeight: 700, color: "#1d4ed8" }}
              disabled={busy}
              onClick={async () => {
                const url = journeyShareUrl(journey.share_token);
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch (err) {
                  console.error(err);
                  window.prompt("Copy share link:", url);
                }
              }}
            >
              {copied ? "COPIED" : "COPY LINK"}
            </button>
          )}
        </div>
      )}
      <div className="sidebar-scrollbar" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem", overflowY: "auto", paddingRight: "0.5rem" }}>
        {places.map((pin) => (
          <div
            key={pin.id}
            style={{ display: "flex", flexDirection: "column", padding: "1rem", cursor: "pointer", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)", background: "rgba(0,0,0,0.02)", transition: "all 0.2s ease" }}
            onClick={() => onSelectPin(pin)}
            onMouseOver={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
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
              {onMovePlace && moveTargets.length > 0 && (
                <button
                  type="button"
                  title="Move to another journey"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMovingPinId(movingPinId === pin.id ? null : pin.id);
                  }}
                  style={{ background: "transparent", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "6px", padding: "0.25rem 0.4rem", cursor: "pointer", color: "#4b5563", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0 }}
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
          <div style={{ textAlign: "center", color: "#4b5563", fontSize: "0.9rem", padding: "2rem 0" }}>
            No places in this journey yet.
          </div>
        )}
      </div>
    </>
  );
}
