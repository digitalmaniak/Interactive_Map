/**
 * Journey date range formatting for list UI. Calendar dates, no time zone.
 */
import { fmtMonthRange } from "../dates/calendar.js";

/** Format a journey date_start/date_end range as "MMM YYYY" or "MMM YYYY – MMM YYYY". */
export function formatJourneyDates(journey) {
  if (!journey) return null;
  return fmtMonthRange(journey.date_start, journey.date_end);
}
