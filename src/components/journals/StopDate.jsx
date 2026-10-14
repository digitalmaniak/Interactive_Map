import { stopDateOrTrip } from "../../lib/dates/calendar";

// A stop's own date, else its trip's dates in 60% grey with " (trip dates)".
export default function StopDate({ pin, journey }) {
  const r = stopDateOrTrip(pin, journey);
  if (!r.text) return "Undated";
  if (!r.fallback) return r.text;
  return <span className="v2-date-est">{r.text} (trip dates)</span>;
}
