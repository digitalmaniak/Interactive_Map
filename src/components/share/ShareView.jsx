"use client";
// Public share view (Prism item 5). View only: the globe opens on the trip, the flyover
// plays once, and the leg list follows it. Reads with the anon key plus x-share-token.
import { miText } from "../../lib/units/distance";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GlobeScene from "../map/scene";
import MapLoader from "../map/MapLoader";
import ModeIcon from "../shell/ModeIcon";
import { loadSharedJourney } from "../../lib/journeys/share";
import { homeLegIdFromRows } from "../../lib/legs/homeLeg";
import { legDate, legEnds, legLine, shareLegs, tripDates } from "../../lib/journeys/shareItinerary";
import { haversineKm } from "../../lib/legs/shortLeg";
import { fmtMonthYear, stopDateOrTrip } from "../../lib/dates/calendar";
import { CINE } from "../map/scene/flyover/cinematicPlan";

const IDLE = { playing: false, paused: false, done: false, legIndex: -1, legId: null };

function useReducedMotion() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const f = () => setOn(mq.matches);
    f();
    mq.addEventListener?.("change", f);
    return () => mq.removeEventListener?.("change", f);
  }, []);
  return on;
}

function useMobile() {
  const [m, setM] = useState({ mobile: false, h: 800 });
  useEffect(() => {
    const f = () => setM({ mobile: window.innerWidth <= 640, h: window.innerHeight });
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return m;
}

export default function ShareView({ token }) {
  const [state, setState] = useState({ loading: true, journey: null, error: null });
  const [fly, setFly] = useState(IDLE);
  const flyApiRef = useRef(null);
  const listRef = useRef(null);
  const reduced = useReducedMotion();
  const { mobile, h } = useMobile();

  useEffect(() => {
    let off = false;
    (async () => {
      if (!token) { setState({ loading: false, journey: null, error: "This link is not valid." }); return; }
      const { data, error } = await loadSharedJourney(token);
      if (off) return;
      if (error || !data) setState({ loading: false, journey: null, error: "This trip is private or the link is not valid." });
      else setState({ loading: false, journey: data, error: null });
    })();
    return () => { off = true; };
  }, [token]);

  const journey = state.journey;
  const pins = useMemo(() => (journey?.places || []).map((p) => ({ ...p, journey_id: journey.id })), [journey]);
  const pinsById = useMemo(() => Object.fromEntries(pins.map((p) => [p.id, p])), [pins]);
  const legs = useMemo(() => (journey ? shareLegs(journey.legs, pins) : []), [journey, pins]);
  const homeId = useMemo(() => homeLegIdFromRows(legs, pins), [legs, pins]);
  const onFlyState = useCallback((s) => setFly(s || IDLE), []);
  // Title card line: "SEP 2023 · 3 STOPS · 7,596 KM".
  const statsLine = useMemo(() => {
    if (!journey) return "";
    const km = legs.reduce((a, l) => {
      const d = Number(l.distance_km);
      if (l.distance_km != null && Number.isFinite(d)) return a + d;
      const e = legEnds(l, pinsById);
      return a + (e ? haversineKm(e.a[1], e.a[0], e.b[1], e.b[0]) : 0);
    }, 0);
    // Counted from the legs loaded on this page (home legs already left out), not trip totals.
    const n = pins.length, fl = legs.filter((l) => l.mode === "fly").length;
    return [fmtMonthYear(journey.date_start), `${n} ${n === 1 ? "STOP" : "STOPS"}`, fl ? `${fl} ${fl === 1 ? "FLIGHT" : "FLIGHTS"}` : "", km > 0 ? miText(km, { upper: true }) : ""].filter(Boolean).join(" · ").toUpperCase();
  }, [journey, legs, pins, pinsById]);
  // Stop card: shown on each hold, out 0.3 s before the next move.
  const [outStep, setOutStep] = useState(-1);
  useEffect(() => {
    if (fly.kind !== "hold" || !fly.playing) return undefined;
    const i = fly.stepI;
    const t = setTimeout(() => setOutStep(i), Math.max(0, (fly.stepMs || 0) - CINE.cardOutLeadMs));
    return () => clearTimeout(t);
  }, [fly.kind, fly.stepI, fly.playing, fly.stepMs]);
  const cardOut = outStep === fly.stepI;
  const cardPin = fly.kind === "hold" && fly.stopPinId ? pinsById[fly.stopPinId] : null;
  const cardDate = cardPin ? stopDateOrTrip(cardPin, journey) : null;
  // Controls: Space pauses, Esc / click / drag skips to the end frame.
  const cineLive = fly.playing || fly.paused;
  useEffect(() => {
    if (!cineLive) return undefined;
    const onKey = (e) => {
      if (e.target?.closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.code === "Space" || e.key === " ") { e.preventDefault(); e.stopPropagation(); flyApiRef.current?.toggle?.(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); flyApiRef.current?.finish?.(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [cineLive]);
  const onStagePointer = (e) => {
    if (!cineLive) return;
    if (e.target?.closest?.(".share-itin, button, a")) return;
    flyApiRef.current?.finish?.();
  };

  // Reduced motion: whole route and a static list, nothing highlighted.
  const live = !reduced && (fly.playing || fly.paused);
  const curIndex = live ? legs.findIndex((l) => l.id === fly.legId) : -1;
  const doneUpTo = live ? (curIndex >= 0 ? curIndex : fly.legIndex) : -1;

  // Keep the lit row in view (the mobile sheet most of all).
  useEffect(() => {
    if (curIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-leg-index="${curIndex}"]`);
    el?.scrollIntoView?.({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [curIndex, reduced]);

  const jump = (leg) => { flyApiRef.current?.seekLeg(leg.id); };
  const replay = () => {
    const api = flyApiRef.current;
    if (!api) return;
    if (fly.paused) api.play();
    else { api.stop(); setTimeout(() => flyApiRef.current?.play(), 50); }
  };
  const restart = () => { const api = flyApiRef.current; if (!api) return; api.stop(); setTimeout(() => flyApiRef.current?.play(), 50); };
  const [sheetOpen, setSheetOpen] = useState(false);
  // Open the trip once the globe has drawn its first frame, so the opening fit (and the
  // reduced motion cut to the final frame) is not lost to the globe's own start up.
  const [globeReady, setGlobeReady] = useState(false);
  const onGlobeMounted = useCallback(() => { setTimeout(() => setGlobeReady(true), 600); }, []);
  // Fallback when no first frame report comes (a hidden tab that does not paint).
  useEffect(() => {
    if (!journey) return undefined;
    const t = setTimeout(() => setGlobeReady(true), 6000);
    return () => clearTimeout(t);
  }, [journey]);
  const viewItinerary = () => {
    if (mobile) setSheetOpen(true);
    listRef.current?.querySelector("button")?.focus();
  };

  if (state.loading || !journey) {
    return (
      <main className="share-globe-page">
        <div className="v2-wordmark share-globe-mark">Odyssey</div>
        <div className="share-empty v2-panel" role="status">
          {state.loading ? <p className="v2-muted">Loading trip...</p> : (
            <>
              <h1 className="share-empty-title">Nothing to show</h1>
              <p className="v2-muted">{state.error}</p>
            </>
          )}
        </div>
      </main>
    );
  }

  const sheetH = mobile ? Math.round(h * (sheetOpen ? 0.62 : 0.38)) : 0;
  const dates = tripDates(journey);

  return (
    <main className={`share-globe-page${cineLive || fly.done ? " is-cine" : ""}`} onPointerDownCapture={onStagePointer}>
      <MapLoader>
        {({ isLoaded, geoJsonData }) => isLoaded && (
          <>
          <GlobeScene
            geoJson={geoJsonData}
            pins={pins}
            focusJourneyId={globeReady ? journey.id : null}
            onFirstFrame={onGlobeMounted}
            focusTitle={journey.title}
            legsOverride={legs}
            autoPlayKey={`share:${journey.id}`}
            cinematic
            onFlyState={onFlyState}
            flyApiRef={flyApiRef}
            onPinClick={() => {}}
            onMapClick={() => {}}
            onHoverRegion={() => {}}
            panelOpen={!mobile}
            panelWidth={mobile ? 0 : 380}
            sheetInset={sheetH}
          />
          </>
        )}
      </MapLoader>
      <div className="v2-wordmark share-globe-mark">Odyssey</div>

      {/* Opening: from black, the globe fades in over 0.8 s. */}
      {fly.kind === "open" && cineLive && !reduced && <div key={`b${fly.stepI}`} className="share-cine-black" aria-hidden="true" />}
      {/* Title card: in at 0.6 s, out as the push-in ends; back on the end frame with the buttons. */}
      {((fly.kind === "open" && cineLive) || fly.done) && (
        <div key={fly.done ? "end" : `t${fly.stepI}`} className={`share-cine-title${fly.done ? " is-end" : ""}${reduced ? " is-still" : ""}`} style={mobile ? { bottom: sheetH + 24 } : { right: 380 }}>
          <h1>{journey.title}</h1>
          {statsLine && <p>{statsLine}</p>}
          {fly.done && (
            <div className="share-cine-actions">
              <button type="button" className="share-cine-btn" onClick={restart}>Replay</button>
              <button type="button" className="share-cine-btn" onClick={viewItinerary}>View itinerary</button>
            </div>
          )}
        </div>
      )}
      {cardPin && cineLive && (
        <div key={`c${fly.stepI}`} className={`share-stop-card${cardOut ? " is-out" : ""}${reduced ? " is-still" : ""}`} style={mobile ? { bottom: sheetH + 16 } : { right: 380 + 24 }}>
          <div className="share-stop-city">{(cardPin.title || cardPin.location_name || "").split(",")[0]}</div>
          <div className="share-stop-country">{(cardPin.location_name || "").split(",").slice(1).join(",").trim()}</div>
          {cardDate?.text && <div className={`share-stop-dates${cardDate.fallback ? " v2-date-est" : ""}`}>{cardDate.text}{cardDate.fallback ? " (trip dates)" : ""}</div>}
        </div>
      )}

      <section
        className={`share-itin v2-panel${mobile ? " is-sheet" : ""}`}
        style={mobile ? { height: sheetH } : undefined}
        aria-label="Itinerary"
      >
        {mobile && (
          <button type="button" className="share-itin-grip" aria-label={sheetOpen ? "Shrink itinerary" : "Expand itinerary"} onClick={() => setSheetOpen((v) => !v)} />
        )}
        <header className="share-itin-head">
          <div>
            <div className="v2-eyebrow">Itinerary</div>
            {dates && <div className="share-itin-dates">{dates}</div>}
          </div>
          {legs.length > 0 && (
            <button type="button" className="share-itin-replay" onClick={replay} aria-label={fly.paused ? "Resume flyover" : "Replay flyover"}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {fly.paused ? <path d="M6 4l10 6-10 6z" /> : <path d="M4 10a6 6 0 1 0 2-4.5M4 3v3h3" />}
              </svg>
              {fly.paused ? "Resume" : "Replay"}
            </button>
          )}
        </header>
        <ol className="share-itin-list" ref={listRef}>
          {legs.map((leg, i) => {
            const cur = i === curIndex;
            const past = !cur && doneUpTo >= 0 && i < doneUpTo;
            const date = legDate(leg, pinsById);
            return (
              <li key={leg.id}>
                <button
                  type="button"
                  data-leg-index={i}
                  className={`share-leg${cur ? " is-current" : ""}${past ? " is-done" : ""}${leg.id === homeId ? " is-home" : ""}`}
                  aria-current={cur ? "step" : undefined}
                  onClick={() => jump(leg)}
                >
                  <span className="share-leg-icon"><ModeIcon mode={leg.mode} /></span>
                  <span className="share-leg-text">{legLine(leg, pinsById)}</span>
                  {date && <span className="share-leg-date">{date}</span>}
                </button>
              </li>
            );
          })}
          {legs.length === 0 && <li className="v2-muted">No legs in this trip yet.</li>}
        </ol>
      </section>
    </main>
  );
}
