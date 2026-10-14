import { fmtMonthYear } from "../dates/calendar.js";
// Pure helpers (also used by scripts/check-review.mjs).
export function groupReviewItems(items, journeys = []) {
  // Same named trips stay distinguishable: "Snowboarding · Feb 2019" from the earliest
  // dated place, else the trip's own date_start (journeys). Undated trips get no suffix.
  const label = (j) => {
    const stopDs = (j.places || []).map((p) => p.start_date).filter(Boolean);
    const ds = (stopDs.length ? stopDs : [j.date_start, j.start_date]).filter(Boolean).map((d) => String(d).slice(0, 10)).sort();
    if (!ds.length) return { text: j.title, sort: `${j.title}|` };
    const m = fmtMonthYear(ds[0]);
    return { text: `${j.title} \u00b7 ${m}`, sort: `${j.title}|${ds[0]}` };
  };
  const title = new Map(journeys.map((j) => [j.id, label(j)]));
  const groups = new Map();
  for (const it of items) {
    const key = it.journey_id ?? "none";
    if (!groups.has(key)) groups.set(key, { journeyId: it.journey_id, title: title.get(it.journey_id)?.text || "Journey", sort: title.get(it.journey_id)?.sort || "Journey|", stops: [], legs: [] });
    (it.kind === "undated_stop" ? groups.get(key).stops : groups.get(key).legs).push(it);
  }
  return [...groups.values()].sort((a, b) => a.sort.localeCompare(b.sort));
}

export function validStopDates(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || "")) return "Pick a start date.";
  if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) return "End date is not valid.";
  if (end && end < start) return "End date is before the start date.";
  return null;
}
