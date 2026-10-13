// Trip flyover timing. All tunables live here so Prism can adjust them in one place.
// Times are milliseconds, angles radians, distances globe radii from the centre.
export const FLYOVER = {
  shortLegMs: 2500, // drive, train, boat, cruise, walk, other, and short flights
  longFlightMs: 4000, // flights longer than longFlightRad
  longFlightRad: 0.15, // about 950 km of great circle
  holdMs: 1500, // pause at each stop with its label prominent
  introMs: 1800, // from the trip fit down to the first stop
  outroMs: 2200, // back to the normal trip fit at the end
  stopDist: 1.06, // camera distance from the centre at a stop (altitude 0.06R)
  tiltDeg: 48, // trip tilt kept through the flyover
  reducedCutMs: 180, // reduced motion: crossfade cut per step, no camera flight
  reducedHoldMs: 1500,
};

// easeInOutCubic, used for every flyover camera move.
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
