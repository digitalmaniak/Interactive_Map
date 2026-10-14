// Region label for a short-leg dot (e.g. the Sixaola to Guabito walk): the countries at the
// leg's own from and to points, "From · To" when they differ. The place name's country wins
// ("Sixaola, Costa Rica"), because 1:110m outlines put border towns on the wrong side; the
// polygon at the endpoint's own (unsnapped) point is next, the dot's point is last.
const clean = (s) => String(s || "").replace(/\([^)]*\)/g, "").trim();

import { countryName } from "../geo/countryName.js";

export function endCountry(end, names, countryAt) {
  // Harbor's from_country / to_country (ISO-2) first, then the place name, then the polygon.
  const iso = countryName(end?.country);
  if (iso) return iso;
  const parts = clean(end?.place ?? end?.label).split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const hit = names.get(parts[parts.length - 1].toLowerCase());
    if (hit) return hit;
  }
  const ll = end?.raw || end;
  return ll && Number.isFinite(ll.lat) ? countryAt({ lat: ll.lat, lon: ll.lon }) : null;
}

export function shortLegRegion(leg, names, countryAt, dotLL) {
  const f = endCountry(leg?.a, names, countryAt), t = endCountry(leg?.b, names, countryAt);
  if (f && t) return f === t ? f : `${f} · ${t}`;
  return f || t || (dotLL ? countryAt(dotLL) : null);
}

/** Lower-cased feature name -> feature name, for matching place-name countries. */
export const countryNames = (features) => new Map((features || []).map((f) => [String(f.properties?.name || "").toLowerCase(), f.properties?.name]));
