// Trips per year from journeys.date_start (Harbor). The "Imported" catch-all and undated
// journeys are not trips. Returns [{ year, n }] oldest first, the last `max` years with trips.
export function tripsPerYear(journeys, max = 5) {
  const by = new Map();
  for (const j of journeys || []) {
    if (!j || j.title === "Imported" || j.deleted_at) continue;
    const y = /^(\d{4})/.exec(String(j.date_start || ""))?.[1];
    if (!y) continue;
    by.set(y, (by.get(y) || 0) + 1);
  }
  return [...by.entries()].map(([year, n]) => ({ year: Number(year), n })).sort((a, b) => a.year - b.year).slice(-max);
}
