// Add entry button label. On the world map: "Add entry". With a trip open: "Add stop to
// [trip name]", or just "Add stop" (full name in the title) when the name is long.
export const ADD_LABEL_MAX_NAME = 18;

export function addEntryLabel(tripName) {
  const name = String(tripName || "").trim();
  if (!name) return { label: "Add entry", title: undefined, short: null };
  if (name.length > ADD_LABEL_MAX_NAME) return { label: "Add stop", title: `Add stop to ${name}`, short: true };
  return { label: `Add stop to ${name}`, title: undefined, short: false, fallback: { label: "Add stop", title: `Add stop to ${name}` } };
}
