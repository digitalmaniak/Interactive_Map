// Mock A finishing touches: trip title, corner crosshairs, home rings.
// Values follow DESIGN.md v2 tokens (title.hero, Corner crosshair, Home ring, ring colour).
export const TRIP_TITLE = {
  maxPx: 112, // title.hero desktop
  minPx: 40,
  phonePx: 56, // title.hero phone
  lineHeight: 0.95,
  weight: 300,
  tracking: "-0.03em",
  left: 48, // px from the visible map left edge, clear of the corner crosshair
  bottom: 48, // px from the bottom, clear of the corner crosshair
  charW: 0.66, // uppercase advance estimate per px of font size, used to fit the width
  reserveRight: 280, // keep clear of the flyover controls at the bottom right
  subPx: 11, // mono subline
  fadeMs: 400,
  fallbackMs: 1200, // show anyway this long after the trip fit starts
};
// Vertical space the title block takes, reserved in the trip fit so pins are never covered.
export const titleReservePx = (H) => TRIP_TITLE.bottom + (H < 600 ? TRIP_TITLE.phonePx : TRIP_TITLE.maxPx) * TRIP_TITLE.lineHeight + 30;

export const CROSSHAIR = { armPx: 16, strokePx: 1, inset: 20, opacity: 0.8, color: "#FFFFFF" };

export const HOME_RINGS = {
  color: "#E6EDF0", // DESIGN.md ring token
  opacity: 0.35,
  radiiR: [0.035, 0.07, 0.105], // about 220, 450, 670 km
  segments: 128,
  lift: 1.0006,
  pulseMs: 3200, // one outward pulse per ring cycle
  pulseAmp: 0.25, // opacity swing, fraction of base
};

// Dated home bases: the base whose range contains the date; no date means the current base.
export function pickHomeBase(bases, date) {
  const list = (bases || []).filter((b) => Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lng)));
  if (!list.length) return null;
  if (!date) return list.find((b) => !b.valid_to) || list[list.length - 1];
  const d = String(date).slice(0, 10);
  return list.find((b) => (!b.valid_from || b.valid_from <= d) && (!b.valid_to || d < b.valid_to)) || null;
}
