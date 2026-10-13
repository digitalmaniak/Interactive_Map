// Pure timeline strip logic (scales, ticks, trip bars, leg placement, playhead mapping).
// No DOM or three.js so scripts/check-timeline.mjs runs it in node.
export const STRIP = {
  heightPx: 64, insetPx: 24, gapPx: 12, hideBelowPx: 600,
  tick: "rgba(230, 237, 240, 0.35)", bar: "rgba(230, 237, 240, 0.6)", barPx: 6, dotPx: 6, minBarPx: 4,
  stopPx: 6, currentPx: 8, accent: "#FF3311", leg: "#5CC8E4",
  guessedAlpha: 0.4, draftAlpha: 0.4, draftGapPx: 2,
  minSpanMs: 365.25 * 864e5, scrubEaseMs: 150, padPx: 16,
};
export const DAY = 864e5;
export const toMs = (d) => (d ? Date.parse(String(d).length <= 10 ? `${String(d).slice(0, 10)}T00:00:00Z` : d) : NaN);

// Linear scale over [t0, t1] onto [x0, x1].
export function makeScale(t0, t1, x0, x1) {
  const k = (x1 - x0) / Math.max(1, t1 - t0);
  return { t0, t1, x0, x1, x: (t) => x0 + (t - t0) * k, t: (x) => t0 + (x - x0) / k };
}

// All time: first trip's year to the end of the current year.
export function allTimeRange(trips, now = Date.now()) {
  const starts = trips.map((t) => toMs(t.first_date)).filter(Number.isFinite);
  const y0 = starts.length ? new Date(Math.min(...starts)).getUTCFullYear() : new Date(now).getUTCFullYear();
  const y1 = new Date(now).getUTCFullYear();
  return { t0: Date.UTC(y0, 0, 1), t1: Date.UTC(y1 + 1, 0, 1) };
}

export function yearTicks(t0, t1) {
  const out = [];
  for (let y = new Date(t0).getUTCFullYear(); Date.UTC(y, 0, 1) <= t1; y++) { const t = Date.UTC(y, 0, 1); if (t >= t0) out.push({ t, label: String(y) }); }
  return out;
}

// Trip bars: start to end; under minBarPx wide becomes a dot.
export function tripMarks(trips, scale) {
  return trips.filter((t) => Number.isFinite(toMs(t.first_date))).map((t) => {
    const a = toMs(t.first_date), b = toMs(t.last_date || t.first_date) + DAY;
    const x0 = scale.x(a), x1 = scale.x(b);
    return { id: t.journey_id, title: t.title || "Journey", x0, x1, dot: x1 - x0 < STRIP.minBarPx, cx: (x0 + x1) / 2 };
  });
}

// Zoom around a cursor time, clamped between minSpan and the full range.
export function zoomRange(view, full, cursorT, factor) {
  const span = Math.min(full.t1 - full.t0, Math.max(STRIP.minSpanMs, (view.t1 - view.t0) * factor));
  const f = (cursorT - view.t0) / Math.max(1, view.t1 - view.t0);
  let t0 = cursorT - f * span;
  t0 = Math.min(Math.max(full.t0, t0), full.t1 - span);
  return { t0, t1: t0 + span };
}
export function panRange(view, full, dt) {
  const span = view.t1 - view.t0;
  const t0 = Math.min(Math.max(full.t0, view.t0 + dt), full.t1 - span);
  return { t0, t1: t0 + span };
}

// Trip range: start day to end day inclusive; one tick a day, labels every day or every 7th.
export function dayTicks(t0, t1, widthPx, minLabelPx = 44) {
  const days = Math.max(1, Math.round((t1 - t0) / DAY));
  const every = widthPx / days >= minLabelPx ? 1 : 7;
  const out = [];
  for (let k = 0; k <= days; k++) out.push({ t: t0 + k * DAY, label: k % every === 0 && k < days ? new Date(t0 + k * DAY).toISOString().slice(5, 10).replace("-", "/") : null });
  return out;
}

// Leg placement by date. Dated: depart_at to arrive_at (arrive defaults to depart).
// Undated: between its from and to stop dates (guessed). Both stops undated too: spread
// the remaining legs evenly across the trip (guessed). Never dropped.
export function placeLegs(legs, pinDates, range) {
  const n = legs.length;
  return legs.map((l, i) => {
    let a = toMs(l.departAt), b = toMs(l.arriveAt);
    let guessed = false;
    if (Number.isFinite(a)) { if (!Number.isFinite(b) || b < a) b = a; }
    else {
      guessed = true;
      const fa = toMs(pinDates[l.fromPinId]?.end || pinDates[l.fromPinId]?.start);
      const tb = toMs(pinDates[l.toPinId]?.start);
      if (Number.isFinite(fa) && Number.isFinite(tb) && tb >= fa) { a = fa; b = tb; }
      else if (Number.isFinite(tb)) { a = tb - DAY / 2; b = tb; }
      else if (Number.isFinite(fa)) { a = fa; b = fa + DAY / 2; }
      else { const w = (range.t1 - range.t0) / n; a = range.t0 + i * w; b = a + w; }
    }
    const draft = l.status === "draft";
    const alpha = guessed || draft ? STRIP.guessedAlpha : 1;
    return { id: l.id, mode: l.mode, a, b, guessed, draft, alpha, solid: l.mode === "fly" };
  });
}

// Playhead mapping: anchors (time in the flyover plan, date) at every stop arrival.
// Piecewise linear both ways; equal dates make a jump, never NaN.
export function planAnchors(plan, stopDates, range) {
  if (!plan || !plan.steps.length) return [];
  const out = [];
  let t = 0, lastD = range.t0;
  plan.steps.forEach((s) => {
    if (s.kind === "hold") {
      const d = stopDates[s.stopIndex];
      lastD = Math.max(lastD, Number.isFinite(d) ? d : lastD);
      out.push({ t, d: lastD, stop: true });
    }
    t += s.ms;
  });
  out.push({ t: plan.totalMs, d: Math.max(lastD, range.t1) });
  if (out[0].t > 0) out.unshift({ t: 0, d: Math.min(range.t0, out[0].d) });
  // Stops sharing a date: spread them evenly up to the next distinct date (at most a day)
  // so the scrub can still reach each one.
  for (let i = 0; i < out.length;) {
    if (!out[i].stop) { i++; continue; }
    let j = i; while (j + 1 < out.length && out[j + 1].stop && out[j + 1].d === out[i].d) j++;
    if (j > i && j + 1 < out.length) {
      const span = Math.min(out[j + 1].d - out[i].d, DAY);
      for (let k = i; k <= j; k++) out[k].d = out[i].d + ((k - i) / (j - i + 1)) * span;
    }
    i = j + 1;
  }
  return out;
}
function interp(arr, key, val, other) {
  if (!arr.length) return 0;
  if (val <= arr[0][key]) return arr[0][other];
  for (let k = 1; k < arr.length; k++) {
    const p = arr[k - 1], q = arr[k];
    if (val <= q[key]) { const span = q[key] - p[key]; return span <= 0 ? q[other] : p[other] + ((val - p[key]) / span) * (q[other] - p[other]); }
  }
  return arr[arr.length - 1][other];
}
export const timeToDate = (anchors, t) => interp(anchors, "t", t, "d");
export const dateToTime = (anchors, d) => interp(anchors, "d", d, "t");
