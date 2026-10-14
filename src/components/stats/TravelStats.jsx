"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchProfileStats } from "../../lib/stats/profileStats";

const fmt = (n) => n.toLocaleString("en-US");

// Travel stats sheet: countries, trips, km, flown km. Esc or the backdrop closes it.
export default function TravelStats({ onClose }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const closeRef = useRef(null);
  useEffect(() => {
    let live = true;
    fetchProfileStats().then((r) => { if (live) setState({ loading: false, data: r.data, error: r.error }); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const s = state.data;
  const items = s ? [["Countries", fmt(s.countries)], ["Trips", fmt(s.trips)], ["Km", fmt(s.km)], ["Flown km", fmt(s.flownKm)]] : [];
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="v2-stats-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="v2-stats" role="dialog" aria-modal="true" aria-label="Travel stats">
        <div className="v2-stats-head">
          <h2>Travel stats</h2>
          <button ref={closeRef} type="button" className="v2-stats-x" aria-label="Close stats" onClick={onClose}>×</button>
        </div>
        {state.loading && <p className="v2-stats-note">Loading…</p>}
        {state.error && <p className="v2-stats-note">Stats are unavailable right now.</p>}
        {s && (
          <dl className="v2-stats-grid">
            {items.map(([k, v]) => (
              <div key={k} className="v2-stats-cell"><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        )}
      </div>
    </div>,
    document.body
  );
}
