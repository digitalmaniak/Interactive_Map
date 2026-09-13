/**
 * Journey date range formatting for list UI.
 */

/** Format a journey date_start/date_end range as "MMM YYYY" or "MMM YYYY – MMM YYYY". */
export function formatJourneyDates(journey) {
  if (!journey) return null;
  const start = journey.date_start ? new Date(journey.date_start) : null;
  const end = journey.date_end ? new Date(journey.date_end) : null;
  const fmt = (d) =>
    d && !isNaN(d.getTime())
      ? d.toLocaleDateString(undefined, { month: "short", year: "numeric" })
      : null;
  const s = fmt(start);
  const e = fmt(end);
  if (s && e && s !== e) return `${s} – ${e}`;
  return s || e || null;
}
