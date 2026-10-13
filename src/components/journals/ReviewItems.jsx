"use client";
import { useEffect, useMemo, useState } from "react";
import { confirmReviewItem, fetchReviewItems, groupReviewItems, validStopDates } from "../../lib/review/api";

const mono = "var(--v2-mono)";
const card = { padding: "0.75rem", border: "1px solid var(--v2-hairline)", borderRadius: "var(--v2-radius)", background: "var(--v2-surface)", display: "flex", flexDirection: "column", gap: "0.5rem" };
const small = { font: `400 10px/1.4 ${mono}`, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--v2-text-dim)" };

/**
 * Review screen: undated stops and draft legs from data_review_items. Nothing changes
 * unless the user taps CONFIRM on that one item. No bulk confirm.
 */
export default function ReviewItems({ journeys, onBack, onConfirmed }) {
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [dates, setDates] = useState({});
  const [busy, setBusy] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const ctl = new AbortController();
    fetchReviewItems(ctl.signal).then(({ items: rows, error }) => {
      if (ctl.signal.aborted) return;
      if (error) setLoadError("Could not load review items. Please try again.");
      setItems(rows);
    });
    return () => ctl.abort();
  }, []);

  const groups = useMemo(() => groupReviewItems(items || [], journeys), [items, journeys]);
  const counts = useMemo(() => ({ stops: (items || []).filter((i) => i.kind === "undated_stop").length, legs: (items || []).filter((i) => i.kind === "draft_leg").length }), [items]);

  const confirm = async (it) => {
    const id = it.item_id;
    const d = dates[id] || {};
    if (it.kind === "undated_stop") {
      const bad = validStopDates(d.start, d.end);
      if (bad) { setErrors((e) => ({ ...e, [id]: bad })); return; }
    }
    setBusy((b) => ({ ...b, [id]: true }));
    setErrors((e) => ({ ...e, [id]: "" }));
    const { changed, error } = await confirmReviewItem({ kind: it.kind, itemId: id, startDate: d.start, endDate: d.end });
    setBusy((b) => ({ ...b, [id]: false }));
    if (error || !changed) { setErrors((e) => ({ ...e, [id]: "Not confirmed. It may have changed already. Please try again." })); return; }
    setItems((list) => list.filter((x) => !(x.item_id === id && x.kind === it.kind)));
    onConfirmed?.(it);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minHeight: 0, flex: 1 }}>
      <button type="button" onClick={onBack} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--v2-text-dim)", cursor: "pointer", font: `400 12px/1 ${mono}`, padding: 0 }}>&larr; All journeys</button>
      <div>
        <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 700, color: "var(--v2-text)" }}>Review</h2>
        <div style={{ ...small, marginTop: 6 }}>{items ? `${counts.stops} undated stops   ${counts.legs} draft legs` : "Loading"}</div>
        <p style={{ fontSize: "0.85rem", color: "var(--v2-text-dim)", margin: "0.5rem 0 0", lineHeight: 1.4 }}>Confirm each item on its own. Nothing changes until you tap Confirm. End dates are optional.</p>
      </div>
      {loadError && <p role="alert" style={{ color: "#FF6B57", fontSize: "0.85rem", margin: 0 }}>{loadError}</p>}
      <div className="sidebar-scrollbar" style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.25rem", paddingRight: "0.5rem" }}>
        {items && items.length === 0 && !loadError && <div style={{ ...small, textAlign: "center", padding: "2rem 0" }}>All caught up</div>}
        {groups.map((g) => (
          <section key={g.journeyId ?? "none"} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <h3 style={{ ...small, color: "var(--v2-text)", margin: 0 }}>{g.title}</h3>
            {g.stops.map((it) => {
              const d = dates[it.item_id] || {};
              const set = (k, v) => { setDates((all) => ({ ...all, [it.item_id]: { ...d, [k]: v } })); setErrors((e) => ({ ...e, [it.item_id]: "" })); };
              return (
                <div key={`s-${it.item_id}`} style={card} data-kind="undated_stop">
                  <div style={small}>Undated stop</div>
                  <div style={{ color: "var(--v2-text)", fontWeight: 600 }}>{it.label}</div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <label style={{ flex: 1, minWidth: 0 }}><span className="panel-label">Start</span><input type="date" className="panel-input" style={{ width: "100%", boxSizing: "border-box" }} value={d.start || ""} onChange={(e) => set("start", e.target.value)} aria-label={`Start date for ${it.label}`} /></label>
                    <label style={{ flex: 1, minWidth: 0 }}><span className="panel-label">End</span><input type="date" className="panel-input" style={{ width: "100%", boxSizing: "border-box" }} value={d.end || ""} onChange={(e) => set("end", e.target.value)} aria-label={`End date for ${it.label}, optional`} /></label>
                  </div>
                  <button type="button" className="glass-pill btn-green" disabled={!!busy[it.item_id]} onClick={() => confirm(it)} style={{ alignSelf: "flex-end" }}>{busy[it.item_id] ? "CONFIRMING..." : "CONFIRM DATES"}</button>
                  {errors[it.item_id] && <p role="alert" style={{ color: "#FF6B57", fontSize: "0.8rem", margin: 0 }}>{errors[it.item_id]}</p>}
                </div>
              );
            })}
            {g.legs.map((it) => (
              <div key={`l-${it.item_id}`} style={card} data-kind="draft_leg">
                <div style={small}>Draft leg{it.detail ? `   ${it.detail}` : ""}</div>
                <div style={{ color: "var(--v2-text)", fontWeight: 600 }}>{it.label}</div>
                <button type="button" className="glass-pill btn-green" disabled={!!busy[it.item_id]} onClick={() => confirm(it)} style={{ alignSelf: "flex-end" }}>{busy[it.item_id] ? "CONFIRMING..." : "CONFIRM LEG"}</button>
                {errors[it.item_id] && <p role="alert" style={{ color: "#FF6B57", fontSize: "0.8rem", margin: 0 }}>{errors[it.item_id]}</p>}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
