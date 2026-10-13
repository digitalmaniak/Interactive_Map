"use client";
// Timeline strip (Prism spec): 64 px glass bar along the bottom of the visible map.
// All time: trips as bars on a year axis, wheel/pinch zoom around the cursor, drag pans.
// Trip view: days, legs by date, stops, and a playhead mapped to flyover time that scrubs
// the existing flyover controller. Undated stops are never placed; a chip opens review.
import { useEffect, useMemo, useRef, useState } from "react";
import { STRIP, DAY, toMs, makeScale, allTimeRange, yearTicks, tripMarks, zoomRange, panRange, dayTicks, placeLegs, planAnchors, timeToDate, dateToTime, tripTimeline, stopPositions, overlapGroups, nearestStop } from "./timelineLogic";

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
  const [stopHover, setStopHover] = useState(null);

  // ---- Trip ----
  const tr = useMemo(() => {
    if (!trip) return null;
    const t = tripTimeline(trip);
    // Stops spread by order: every leg is a guess (40%); with no trip dates at all, leg
    // dates are ignored too so nothing lands outside the order-only range.
    const src = t.undated ? trip.legs.map((l) => ({ ...l, departAt: null, arriveAt: null })) : trip.legs;
    const legs = placeLegs(src, t.pinDates, t.range).map((l) => (t.spread ? { ...l, guessed: true, alpha: STRIP.guessedAlpha } : l));
    return { ...t, legs };
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

  // Trip name hover label: tagged with the view it was set in, so any view change (trip
  // opened or closed, zoom, pan) drops it.
  const viewKey = `${tr ? `trip:${tr.range.t0}:${tr.range.t1}` : "all"}|${v.t0}|${v.t1}`;
  const hoverNow = hover && hover.key === viewKey ? hover.m : null;

  const ticks = tr ? (tr.undated ? [{ t: tr.range.t0, label: "Undated" }, { t: tr.range.t1, label: null }] : dayTicks(tr.range.t0, tr.range.t1, x1 - x0)) : yearTicks(v.t0, v.t1);
  const cy = 38;
  const current = currentPinId;
  // Stop dots sit where the playhead lands for that stop (anchors), else at their date.
  const dots = tr ? stopPositions(trip.stops, tr.pinDates, anchors, plan, scale) : [];
  const groups = overlapGroups(dots, STRIP.currentPx);
  // All time: trip dots that overlap pick the nearest on click and carry a "+N" badge.
  const marks = tr ? [] : tripMarks(trips, scale).filter((m) => m.x1 >= x0 && m.x0 <= x1);
  const dotMarks = marks.filter((m) => m.dot).map((m) => ({ ...m, x: m.cx }));
  const tripGroups = overlapGroups(dotMarks, STRIP.dotPx);
  const nearestMark = (clientX) => { const r = box.current.getBoundingClientRect(); return nearestStop(dotMarks, clientX - r.left); };
  // Trip view: stop name on hover (nearest dot), cleared on leave and on view change.
  const stopHoverNow = stopHover && stopHover.key === viewKey ? dots.find((d) => d.id === stopHover.id) : null;
  const hoverStopAt = (e) => { const r = box.current.getBoundingClientRect(); const d = nearestStop(dots, e.clientX - r.left); if (d && d.id !== stopHoverNow?.id) setStopHover({ id: d.id, key: viewKey }); };
  const pickStop = (e) => {
    const r = box.current.getBoundingClientRect();
    const d = nearestStop(dots, e.clientX - r.left);
    if (d) onStopClick?.(d.id);
  };

  return (
    <div ref={box} className={`v2-timeline${lite ? " is-lite" : ""}`} style={{ left, right }} role="region" aria-label={tr ? "Trip timeline" : "Trips timeline"}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onMouseLeave={() => { setHover(null); setStopHover(null); }}>
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
      {!tr && marks.map((m) => {
        const g = m.dot ? tripGroups.get(m.id) : null;
        const badgeOn = g && g.size > 1 && g.ids[0] === m.id;
        return (
          <button key={m.id} type="button" data-hit className="v2-tl-trip" aria-label={`Open ${m.title}`} data-trip={m.id}
            style={m.dot ? { left: m.cx - STRIP.dotPx / 2, width: STRIP.dotPx, borderRadius: "50%", zIndex: badgeOn ? 2 : undefined } : { left: Math.max(x0, m.x0), width: Math.min(x1, m.x1) - Math.max(x0, m.x0) }}
            onMouseEnter={(e) => setHover({ m: m.dot ? nearestMark(e.clientX) || m : m, key: viewKey })}
            onMouseMove={(e) => { if (m.dot) { const n = nearestMark(e.clientX); if (n && n.id !== hoverNow?.id) setHover({ m: n, key: viewKey }); } }}
            onMouseLeave={() => setHover(null)} onFocus={() => setHover({ m, key: viewKey })} onBlur={() => setHover(null)}
            onClick={(e) => onOpenTrip?.(m.dot ? (nearestMark(e.clientX) || m).id : m.id)}>
            {badgeOn && <span className="v2-tl-more" aria-hidden="true">+{g.size - 1}</span>}
          </button>
        );
      })}
      {!tr && hoverNow && <div className="v2-tl-tip" style={{ left: Math.min(x1 - 120, Math.max(x0, (hoverNow.x ?? hoverNow.cx) - 60)) }}>{hoverNow.title}</div>}
      {tr && dots.map((d) => {
        const cur = d.id === current; const sz = cur ? STRIP.currentPx : STRIP.stopPx;
        const g = groups.get(d.id);
        // "+N" sits on the dot a click would pick: the current one, else the group's first.
        const badgeOn = g && g.size > 1 && (g.ids.includes(current) ? current === d.id : g.ids[0] === d.id);
        return (
          <button key={d.id} type="button" data-hit className={`v2-tl-stop${cur ? " is-current" : ""}`} aria-label={`Fly to ${d.label}`} title={d.label} data-stop={d.id}
            style={{ left: d.x - sz / 2, top: cy - sz / 2, width: sz, height: sz, zIndex: badgeOn ? 2 : cur ? 1 : undefined }} onClick={pickStop} onMouseEnter={hoverStopAt} onMouseMove={hoverStopAt} onMouseLeave={() => setStopHover(null)} onFocus={() => setStopHover({ id: d.id, key: viewKey })} onBlur={() => setStopHover(null)}>
            {badgeOn && <span className="v2-tl-more" aria-hidden="true">+{g.size - 1}</span>}
          </button>
        );
      })}
      {tr && stopHoverNow && <div className="v2-tl-tip is-stop" style={{ left: Math.min(x1 - 160, Math.max(x0, stopHoverNow.x - 80)) }}>{stopHoverNow.label}</div>}
      {tr && fly && anchors.length > 0 && (
        <div ref={head} className="v2-tl-head" style={{ transition: scrubbing && !reducedMotion ? `transform ${STRIP.scrubEaseMs}ms ease` : "none" }} aria-hidden="true" />
      )}
      {undatedCount > 0 && (
        <button type="button" data-hit className="v2-tl-chip" onClick={onOpenReview}>{undatedCount} undated</button>
      )}
    </div>
  );
}
