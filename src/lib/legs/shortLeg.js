// Legs under 2 km (a border crossed on foot, a short transfer) draw as one small dot at
// the midpoint, with no arc or line. Hover shows "Walk · 0.8 km".
export const SHORT_LEG_KM = 2;
const MODE_NAME = { fly: "Fly", drive: "Drive", train: "Train", boat: "Boat", cruise: "Cruise", walk: "Walk", other: "Other" };

export function haversineKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Leg length in km: the stored distance, else great circle between its ends. */
export function legKm(distanceKm, a, b) {
  const d = Number(distanceKm);
  if (distanceKm != null && Number.isFinite(d)) return d;
  return a && b ? haversineKm(a.lat, a.lon, b.lat, b.lon) : null;
}

export const isShortLeg = (km) => km != null && km < SHORT_LEG_KM;

export function shortLegLabel(mode, km) {
  const name = MODE_NAME[mode] || "Other";
  return `${name} · ${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
