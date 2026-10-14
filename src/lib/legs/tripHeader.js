// Trip header counts: "2 STOPS · 4 FLIGHTS · 23,290 KM". Flights are fly legs; the
// flights part is left out at 0. Distance sums every leg (flights included).
export function tripCounts(stopCount, legs) {
  const stops = `${stopCount} ${stopCount === 1 ? "STOP" : "STOPS"}`;
  const n = (legs || []).filter((l) => l.mode === "fly").length;
  const flights = n ? `${n} ${n === 1 ? "FLIGHT" : "FLIGHTS"}` : "";
  const km = (legs || []).reduce((a, l) => a + (Number(l.distanceKm) || (l.a && l.b ? l.a.v.angleTo(l.b.v) * 6371 : 0)), 0);
  const kmText = km > 0 ? `${Math.round(km).toLocaleString("en-US")} KM` : "";
  return { stops, flights, km: kmText };
}
