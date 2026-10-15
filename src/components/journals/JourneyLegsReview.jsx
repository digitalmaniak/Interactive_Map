"use client";

import { miText } from "../../lib/units/distance";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fmtDay } from "../../lib/dates/calendar";
import { LEG_MODES, fetchJourneyLegs, sharedJourneyLegs, updateLegMode, confirmJourneyLegs } from "../../lib/journeys/legs";

const MODE_LABEL = { fly: "Fly", drive: "Drive", train: "Train", boat: "Boat", cruise: "Cruise", walk: "Walk", other: "Other" };

const fmtDate = (v) => fmtDay(v);

// Coordinates may arrive as numeric strings or be null (a leg ending at a labeled
// place with no pin, such as "Newark (EWR)"). Never throws.
const fmtCoord = (lat, lng) => {
  if (lat == null || lng == null || lat === "" || lng === "") return null;
  const a = Number(lat), b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) ? `${a.toFixed(2)}, ${b.toFixed(2)}` : null;
};

const fmtKm = (km) => {
  if (!Number.isFinite(km)) return null;
  return miText(km);
};

/**
 * Trip legs review (v2). Ordered legs for one journey with a one tap mode control
 * (optimistic update, rolled back on error) and a Confirm legs action that calls
 * the confirm_journey_legs RPC.
 */
export default function JourneyLegsReview({ journey, pinsById, onBack, onConfirmed }) {
  const [legs, setLegs] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(null);
  const [rowError, setRowError] = useState({});
  const [pending, setPending] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setLegs(await fetchJourneyLegs(journey.id));
    } catch (err) {
      setLoadError(err?.message || "Could not load legs");
      setLegs([]);
    }
  }, [journey.id]);

  useEffect(() => {
    let alive = true;
    const req = sharedJourneyLegs(journey.id); // same request as the globe, not a second one
    req.promise
      .then((rows) => { if (alive) setLegs(rows); })
      .catch((err) => { if (alive && err?.name !== "AbortError") { setLoadError(err?.message || "Could not load legs"); setLegs([]); } });
    return () => { alive = false; req.release(); };
  }, [journey.id]);

  const placeName = useCallback(
    (pinId, label, lat, lng) => {
      const pin = pinId ? pinsById?.[pinId] : null;
      const fromPin = pin ? (pin.location_name || pin.title || "").split(",")[0].trim() : "";
      return fromPin || label || fmtCoord(lat, lng) || "Unknown place";
    },
    [pinsById]
  );

  const legDates = useCallback(
    (leg) => {
      const dep = fmtDate(leg.depart_at);
      const arr = fmtDate(leg.arrive_at);
      if (dep && arr && dep !== arr) return `${dep} to ${arr}`;
      if (dep || arr) return dep || arr;
      const toPin = leg.to_pin_id ? pinsById?.[leg.to_pin_id] : null;
      return fmtDate(toPin?.start_date) || "Undated";
    },
    [pinsById]
  );

  const setMode = async (leg, mode) => {
    if (leg.mode === mode || pending[leg.id]) return;
    const prev = leg.mode;
    setRowError((e) => ({ ...e, [leg.id]: null }));
    setPending((p) => ({ ...p, [leg.id]: true }));
    setLegs((ls) => ls.map((l) => (l.id === leg.id ? { ...l, mode } : l)));
    try {
      await updateLegMode(leg.id, mode);
    } catch (err) {
      setLegs((ls) => ls.map((l) => (l.id === leg.id ? { ...l, mode: prev } : l)));
      setRowError((e) => ({ ...e, [leg.id]: err?.message || "Could not save mode" }));
    } finally {
      setPending((p) => ({ ...p, [leg.id]: false }));
    }
  };

  const draftCount = useMemo(() => (legs || []).filter((l) => l.status === "draft").length, [legs]);
  const totalKm = useMemo(() => (legs || []).reduce((s, l) => s + (Number(l.distance_km) || 0), 0), [legs]);

  const confirm = async () => {
    if (confirming || !legs?.length) return;
    setConfirming(true);
    setNotice(null);
    try {
      const n = await confirmJourneyLegs(journey.id);
      setLegs((ls) => ls.map((l) => ({ ...l, status: "confirmed" })));
      setNotice({ ok: true, text: `${Number.isFinite(n) ? n : draftCount} legs confirmed.` });
      onConfirmed?.(journey.id);
    } catch (err) {
      setNotice({ ok: false, text: err?.message || "Could not confirm legs" });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="legs-review">
      <div className="legs-head">
        <button type="button" className="legs-back" onClick={onBack} aria-label="Back to journeys">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="legs-head-text">
          <div className="legs-eyebrow">Review legs</div>
          <h2 className="legs-title">{journey.title}</h2>
        </div>
      </div>

      {legs && legs.length > 0 && (
        <div className="legs-summary">
          <span>{legs.length} {legs.length === 1 ? "leg" : "legs"}</span>
          <span>{fmtKm(totalKm) || "0 mi"}</span>
          <span className={draftCount ? "legs-draft" : "legs-done"}>{draftCount ? `${draftCount} draft` : "All confirmed"}</span>
        </div>
      )}

      <div className="legs-list sidebar-scrollbar">
        {legs === null ? (
          <div className="legs-state" role="status" aria-busy="true">Loading legs</div>
        ) : loadError ? (
          <div className="legs-state">
            <p className="legs-error" role="alert">{loadError}</p>
            <button type="button" className="legs-btn legs-btn-ghost" onClick={load}>Try again</button>
          </div>
        ) : legs.length === 0 ? (
          <div className="legs-state">No legs for this journey yet. Legs appear once places have home bases and dates.</div>
        ) : (
          <ol className="legs-ol">
            {legs.map((leg, i) => (
              <li key={leg.id} className={`legs-card${leg.status === "draft" ? " is-draft" : ""}`}>
                <div className="legs-row-top">
                  <span className="legs-idx">{String(i + 1).padStart(2, "0")}</span>
                  <span className="legs-date">{legDates(leg)}</span>
                  <span className="legs-km">{fmtKm(Number(leg.distance_km)) || ""}</span>
                </div>
                <div className="legs-route">
                  <span className="legs-place">{placeName(leg.from_pin_id, leg.from_label, leg.from_lat, leg.from_lng)}</span>
                  <span className="legs-arrow" aria-hidden="true">→</span>
                  <span className="legs-place">{placeName(leg.to_pin_id, leg.to_label, leg.to_lat, leg.to_lng)}</span>
                </div>
                <div className="legs-modes" role="radiogroup" aria-label="Travel mode">
                  {LEG_MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={leg.mode === m}
                      className={`legs-mode${leg.mode === m ? " is-on" : ""}`}
                      onClick={() => setMode(leg, m)}
                      disabled={confirming}
                    >
                      {MODE_LABEL[m]}
                    </button>
                  ))}
                </div>
                {rowError[leg.id] ? <p className="legs-error" role="alert">{rowError[leg.id]}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      {notice ? (
        <p role={notice.ok ? "status" : "alert"} className={notice.ok ? "legs-ok" : "legs-error"}>{notice.text}</p>
      ) : null}

      {legs && legs.length > 0 && (
        <button type="button" className="legs-btn legs-btn-primary" onClick={confirm} disabled={confirming || draftCount === 0}>
          {confirming ? "Confirming" : draftCount === 0 ? "Legs confirmed" : `Confirm legs (${draftCount})`}
        </button>
      )}
    </div>
  );
}
