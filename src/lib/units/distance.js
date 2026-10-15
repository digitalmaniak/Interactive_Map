// Distances display in miles (the owner is in the US). Data stays in km; convert at display.
export const KM_PER_MI = 1.609344;
export const kmToMi = (km) => (Number(km) || 0) / KM_PER_MI;
/** "3,355 mi" (whole miles), or one decimal under 10 mi: "0.5 mi". */
export function miText(km, { upper = false } = {}) {
  const mi = kmToMi(km);
  const s = `${mi < 10 ? Number(mi.toFixed(1)).toLocaleString("en-US") : Math.round(mi).toLocaleString("en-US")} ${upper ? "MI" : "mi"}`;
  return s;
}
