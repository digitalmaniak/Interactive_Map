"use client";
// Timeline strip (Prism spec): 64 px glass bar along the bottom of the visible map.
// All time: trips as bars on a year axis, wheel/pinch zoom around the cursor, drag pans.
// Trip view: days, legs by date, stops, and a playhead mapped to flyover time that scrubs
// the existing flyover controller. Undated stops are never placed; a chip opens review.
import { useEffect, useMemo, useRef, useState } from "react";
import { STRIP, DAY, toMs, makeScale, allTimeRange, yearTicks, tripMarks, zoomRange, panRange, dayTicks, placeLegs, planAnchors, timeToDate, dateToTime } from "./timelineLogic";

const mono = "var(--v2-mono)";

export default function TimelineStrip({ left, right, lite, reducedMotion, trips = [], onOpenTrip, undatedCount = 0, onOpenReview, trip = null, currentPinId = null, fly = null, onStopClick }) {
  const box = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = box.current; if (!el) return undefined;
    const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const chipW = undatedCount > 0 ? 104 : 0;
  const x0 = STRIP.padPx, x1 = Math.max(x0 + 40, w - STRIP.padPx - chipW);

  // ---- All time ----
  const full = useMemo(() => allTimeRange(trips), [trips]);
  const [view, setView] = useState(null);
  const v = view && view.t0 >= full.t0 && view.t1 <= full.t1 ? view : full;
  const [hover, setHover] = useState(null);

  // ---- Trip ----
  const tr = useMemo(() => {
    if (!trip || !trip.from) return null;
    const range = { t0: toMs(trip.from), t1: toMs(trip.to) + DAY };
    const pinDates = Object.fromEntries(trip.stops.map((s) => [s.id, { start: s.start, end: s.end }]));
    return { range, legs: placeLegs(trip.legs, pinDates, range), pinDates };
  }, [trip]);
  const plan = useMemo(() => (tr && fly ? fly.planNow() : null), [tr, fly]);
  const anchors = useMemo(() => {
    if (!tr || !plan) return [];
    const stopDates = plan.stops.map((s) => toMs(tr.pinDates[s.pinId]?.start));
    return planAnchors(plan, stopDates, tr.range);
  }, [tr, plan]);

  const scale = tr ? makeScale(tr.range.t0, tr.range.t1, x0, x1) : makeScale(v.t0, v.t1, x0, x1);

  // Playhead follows flyover time while playing; scrubbing seeks it.
  const head = useRef(null);
  const [scrubbing, setScrubbing] = useState(false);
  useEffect(() => {
    if (!tr || !fly) return undefined;
    let raf = 0;
    const tick = () => {
      if (head.current && anchors.length) {
        const st = fly.state;
        const t = st.playing || st.paused ? fly.timeNow() : 0;
        head.current.style.transform = `translateX(${scale.x(timeToDate(anchors, t))}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });
  const scrubTo = (clientX) => {
    const r = box.current.getBoundingClientRect();
    const x = Math.min(x1, Math.max(x0, clientX - r.left));
    fly.seek(dateToTime(anchors, scale.t(x)), reducedMotion ? 1 : STRIP.scrubEaseMs);
  };

  // Pointer: trip view scrubs, all time pans (drag) and zooms (wheel, pinch).
  const drag = useRef(null);
  const pts = useRef(new Map());
  const onDown = (e) => {
    if (e.target.closest("[data-hit]")) return;
    box.current.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, e.clientX);
    if (tr) { if (fly && anchors.length) { setScrubbing(true); scrubTo(e.clientX); } return; }
    drag.current = { x: e.clientX, view: v, pinch: null };
  };
  const onMove = (e) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, e.clientX);
    if (tr) { if (scrubbing) scrubTo(e.clientX); return; }
    const d = drag.current; if (!d) return;
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()]; const dist = Math.abs(a - b);
      if (d.pinch) { const r = box.current.getBoundingClientRect(); setView((cur) => zoomRange(cur || full, full, scale.t((a + b) / 2 - r.left), d.pinch / Math.max(1, dist))); }
      d.pinch = dist; return;
    }
    const dt = -(e.clientX - d.x) * ((d.view.t1 - d.view.t0) / Math.max(1, x1 - x0));
    setView(panRange(d.view, full, dt));
  };
  const onUp = (e) => { pts.current.delete(e.pointerId); if (pts.current.size === 0) { drag.current = null; setScrubbing(false); } };
  useEffect(() => {
    const el = box.current; if (!el || tr) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setView((cur) => { const c = cur || full; const s = makeScale(c.t0, c.t1, x0, x1); return zoomRange(c, full, s.t(e.clientX - r.left), Math.exp(e.deltaY * 0.002)); });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [tr, full, x0, x1]);

  const ticks = tr ? dayTicks(tr.range.t0, tr.range.t1, x1 - x0) : yearTicks(v.t0, v.t1);
  const cy = 38;
  const current = currentPinId;

  return (
    <div ref={box} className={`v2-timeline${lite ? " is-lite" : ""}`} style={{ left, right }} role="region" aria-label={tr ? "Trip timeline" : "Trips timeline"}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <svg width={w} height={STRIP.heightPx} aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
        {ticks.map((t) => {
          const x = scale.x(t.t); if (x < x0 - 0.5 || x > x1 + 0.5) return null;
          return (
            <g key={t.t}>
              <line x1={x} x2={x} y1={tr ? 26 : 22} y2={tr ? 32 : 46} stroke={STRIP.tick} strokeWidth="1" shapeRendering="crispEdges" />
              {t.label && <text x={x + 3} y={16} fill="rgba(230,237,240,0.6)" style={{ font: `400 11px ${mono}`, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.label}</text>}
            </g>
          );
        })}
        {tr && tr.legs.map((l) => {
          const a = scale.x(l.a), b = Math.max(scale.x(l.b), a + 2);
          const gap = l.draft ? STRIP.draftGapPx : 0;
          return <line key={l.id} data-leg={l.id} x1={a + gap} x2={b - gap} y1={cy} y2={cy} stroke={STRIP.leg} strokeOpacity={l.alpha} strokeWidth={l.solid ? 2 : 1.5} strokeDasharray={l.solid ? undefined : "4 3"} />;
        })}
      </svg>
      {!tr && tripMarks(trips, scale).filter((m) => m.x1 >= x0 && m.x0 <= x1).map((m) => (
        <button key={m.id} type="button" data-hit className="v2-tl-trip" aria-label={`Open ${m.title}`}
          style={m.dot ? { left: m.cx - STRIP.dotPx / 2, width: STRIP.dotPx, borderRadius: "50%" } : { left: Math.max(x0, m.x0), width: Math.min(x1, m.x1) - Math.max(x0, m.x0) }}
          onMouseEnter={() => setHover(m)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(m)} onBlur={() => setHover(null)}
          onClick={() => onOpenTrip?.(m.id)} />
      ))}
      {!tr && hover && <div className="v2-tl-tip" style={{ left: Math.min(x1 - 120, Math.max(x0, hover.cx - 60)) }}>{hover.title}</div>}
      {tr && trip.stops.filter((s) => s.start).map((s) => {
        const x = scale.x(toMs(s.start) + DAY / 2); const cur = s.id === current; const sz = cur ? STRIP.currentPx : STRIP.stopPx;
        return <button key={s.id} type="button" data-hit className={`v2-tl-stop${cur ? " is-current" : ""}`} aria-label={`Fly to ${s.label}`} title={s.label}
          style={{ left: x - sz / 2, top: cy - sz / 2, width: sz, height: sz }} onClick={() => onStopClick?.(s.id)} />;
      })}
      {tr && fly && anchors.length > 0 && (
        <div ref={head} className="v2-tl-head" style={{ transition: scrubbing && !reducedMotion ? `transform ${STRIP.scrubEaseMs}ms ease` : "none" }} aria-hidden="true" />
      )}
      {undatedCount > 0 && (
        <button type="button" data-hit className="v2-tl-chip" onClick={onOpenReview}>{undatedCount} undated</button>
      )}
    </div>
  );
}
