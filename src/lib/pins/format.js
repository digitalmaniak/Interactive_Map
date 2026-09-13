/**
 * Pure pin date formatting / sort helpers extracted from MapCanvas.
 * Behavior-identical to the prior inline implementations.
 */

/** Safely format a stored date string as "MMM YYYY"; returns null for missing/invalid. */
export function formatPinDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** Comparator: ascending by start_date; undated pins sort last (Infinity). */
export function comparePinsByStartDate(a, b) {
  return (
    (a.start_date ? new Date(a.start_date).getTime() : Infinity) -
    (b.start_date ? new Date(b.start_date).getTime() : Infinity)
  );
}

/** Return a new array of pins sorted by start_date ascending (undated last). */
export function sortPinsByStartDate(pins) {
  return [...pins].sort(comparePinsByStartDate);
}
