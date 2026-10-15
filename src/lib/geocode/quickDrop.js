// One-step quick add: a picked place becomes a pin row with no form. Harbor's rules:
// user_id is the signed-in user, journey_id is the current trip (never left to the DB
// default), country_code is the geocoder's ISO 3166-1 alpha-2 code. No code: no save.
export const NO_COUNTRY_MSG = "Couldn't tell which country that place is in. Try a more specific search.";

export function quickPinFields(r, { userId, journeyId, placeLine, now = new Date().toISOString() }) {
  const code = String(r?.countryCode || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return { error: NO_COUNTRY_MSG };
  if (!userId) return { error: "Sign in to add a stop." };
  if (!journeyId) return { error: "No trip to add the stop to." };
  const lat = parseFloat(Number(r.lat).toFixed(4)), lon = parseFloat(Number(r.lng).toFixed(4));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return { error: "That place has no usable location." };
  return {
    fields: {
      user_id: userId, journey_id: journeyId, country_code: code,
      title: r.name, location_name: (placeLine && placeLine(r)) || r.name,
      latitude: lat, longitude: lon, start_date: null, end_date: null,
      trip_type: "Unknown", created_at: now, updated_at: now,
    },
  };
}
