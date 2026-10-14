/**
 * Pure pin date formatting / sort helpers extracted from MapCanvas.
 * Behavior-identical to the prior inline implementations.
 */
import { fmtMonthYear, ymdKey } from "../dates/calendar.js";

/** Safely format a stored date string as "MMM YYYY"; returns null for missing/invalid. */
export function formatPinDate(dateStr) {
  return fmtMonthYear(dateStr);
}

/** Comparator: ascending by start_date; undated pins sort last (Infinity). */
export function comparePinsByStartDate(a, b) {
  return (
    ymdKey(a.start_date) - ymdKey(b.start_date)
  );
}

/** Return a new array of pins sorted by start_date ascending (undated last). */
export function sortPinsByStartDate(pins) {
  return [...pins].sort(comparePinsByStartDate);
}
