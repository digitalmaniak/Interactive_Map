// Share legs: Harbor's get_shared_legs(token) RPC first (server-side home filtering, flight
// ends at home snapped to EWR/JFK, flagged snapped_end). Until it exists, fall back to the
// direct journey_legs read. Only a missing function falls back; nothing breaks in either order.
const AIRPORTS = [
  { code: "EWR", label: "Newark (EWR)", lat: 40.6895, lng: -74.1745 },
  { code: "JFK", label: "New York (JFK)", lat: 40.6413, lng: -73.7781 },
];

/** True for PostgREST / Postgres "function does not exist" answers (404, PGRST202, 42883). */
export function isMissingRpc(error, status) {
  if (status === 404) return true;
  const code = error?.code || "";
  return code === "PGRST202" || code === "42883" || /could not find the function|does not exist/i.test(String(error?.message || ""));
}

const nearestAirport = (lat, lng) => {
  let best = AIRPORTS[0], bd = Infinity;
  for (const a of AIRPORTS) { const d = (a.lat - lat) ** 2 + (a.lng - lng) ** 2; if (d < bd) { bd = d; best = a; } }
  return best;
};

/** Label the snapped airport end ("from", "to", "both" or true for the pinless end). */
export function labelSnapped(row) {
  const f = row?.snapped_end;
  if (!f) return row;
  const sides = f === "both" ? ["from", "to"] : f === "from" || f === "to" ? [f] : ["from", "to"].filter((s) => !row[`${s}_pin_id`]);
  const out = { ...row };
  for (const s of sides) {
    const lat = Number(row[`${s}_lat`]), lng = Number(row[`${s}_lng`]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out[`${s}_label`] = nearestAirport(lat, lng).label;
  }
  return out;
}
