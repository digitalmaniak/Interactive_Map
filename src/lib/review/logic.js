// Pure helpers (also used by scripts/check-review.mjs).
export function groupReviewItems(items, journeys = []) {
  const title = new Map(journeys.map((j) => [j.id, j.title]));
  const groups = new Map();
  for (const it of items) {
    const key = it.journey_id ?? "none";
    if (!groups.has(key)) groups.set(key, { journeyId: it.journey_id, title: title.get(it.journey_id) || "Journey", stops: [], legs: [] });
    (it.kind === "undated_stop" ? groups.get(key).stops : groups.get(key).legs).push(it);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export function validStopDates(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || "")) return "Pick a start date.";
  if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) return "End date is not valid.";
  if (end && end < start) return "End date is before the start date.";
  return null;
}
