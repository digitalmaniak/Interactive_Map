// Date-only values ("2023-09-01") are plain calendar dates: never parsed through Date,
// which reads them as UTC midnight and shifts to the previous day west of UTC.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** { y, m, d } from "YYYY-MM-DD" (or a longer ISO string's date part); null if invalid. */
export function parseYmd(v) {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? { y, m: mo, d } : null;
}
/** "Sep 2023" */
export function fmtMonthYear(v) { const p = parseYmd(v); return p ? `${MONTHS[p.m - 1]} ${p.y}` : null; }
/** "Sep 1, 2023" */
export function fmtDay(v) { const p = parseYmd(v); return p ? `${MONTHS[p.m - 1]} ${p.d}, ${p.y}` : null; }
/** "Sep 2023" or "Jan 2025 – Feb 2025" */
export function fmtMonthRange(a, b) {
  const s = fmtMonthYear(a), e = fmtMonthYear(b);
  if (s && e && s !== e) return `${s} – ${e}`;
  return s || e || null;
}
/** Sort key for a date-only value (ms at UTC midnight, zone independent). */
export function ymdKey(v) { const p = parseYmd(v); return p ? Date.UTC(p.y, p.m - 1, p.d) : Infinity; }
/** First and last day of a month as "YYYY-MM-DD". */
export function monthBounds(y, m) {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (n) => String(n).padStart(2, "0");
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}` };
}
/** Stop date, else the trip's dates marked as a fallback. */
export function stopDateOrTrip(pin, journey) {
  const own = fmtMonthYear(pin?.start_date);
  if (own) return { text: own, fallback: false };
  const t = fmtMonthRange(journey?.date_start, journey?.date_end);
  return t ? { text: t, fallback: true } : { text: null, fallback: false };
}
