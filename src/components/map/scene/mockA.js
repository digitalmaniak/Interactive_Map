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
  chipGap: 12, // gap above the profile chip
  narrowPx: 720, // below this visible width the subline drops the km figure
  fallbackMs: 1200, // show anyway this long after the trip fit starts
};
// Vertical space the title block takes, reserved in the trip fit so pins are never covered.
// The title sits above the bottom left profile chip (safe area: chip height plus a gap),
// never on top of it. chipPx is the chip's distance from the bottom edge to its top.
export const titleBottomPx = (chipPx = 0) => Math.max(TRIP_TITLE.bottom, chipPx > 0 ? chipPx + TRIP_TITLE.chipGap : 0);
// Title block height: one hero line (or two half size lines) plus a subline that may wrap.
export const titleBlockPx = (H) => (H < 600 ? TRIP_TITLE.phonePx : TRIP_TITLE.maxPx) * TRIP_TITLE.lineHeight + 30 + 16;
export const titleReservePx = (H, chipPx = 0) => titleBottomPx(chipPx) + titleBlockPx(H);

export const CROSSHAIR = { armPx: 16, strokePx: 1, inset: 20, opacity: 0.8, color: "#FFFFFF" };

export const HOME_RINGS = {
  color: "#5CC8E4", // --v2-route, the app's cyan token
  scale: [1, 1.8, 2.6], // ring radius in pin sizes (pin scale, not km)
  opacity: [0.6, 0.35, 0.15], // inner to outer
  segments: 96,
  lift: 1.0006,
};

// Dated home bases: the base whose range contains the date; no date means the current base.
export function pickHomeBase(bases, date) {
  const list = (bases || []).filter((b) => Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lng)));
  if (!list.length) return null;
  if (!date) return list.find((b) => !b.valid_to) || list[list.length - 1];
  const d = String(date).slice(0, 10);
  return list.find((b) => (!b.valid_from || b.valid_from <= d) && (!b.valid_to || d < b.valid_to)) || null;
}
