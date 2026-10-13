import * as THREE from "three";
import { geoArea, geoEquirectangular, geoPath } from "d3-geo";

export const GLOBE_R = 1;

// d3-geo treats a backwards wound exterior ring as covering almost the whole
// sphere. Rewind any such polygon so its area is the smaller side.
const rewindPolygon = (rings) => {
  if (!rings || !rings.length) return rings;
  if (geoArea({ type: "Polygon", coordinates: [rings[0]] }) > 2 * Math.PI) {
    return [rings[0].slice().reverse(), ...rings.slice(1)];
  }
  return rings;
};

export const rewindGeo = (fc) => {
  if (!fc) return fc;
  return {
    ...fc,
    features: fc.features.map((f) => {
      const g = f.geometry;
      if (!g) return f;
      if (g.type === "Polygon") return { ...f, geometry: { ...g, coordinates: rewindPolygon(g.coordinates) } };
      if (g.type === "MultiPolygon") return { ...f, geometry: { ...g, coordinates: g.coordinates.map(rewindPolygon) } };
      return f;
    }),
  };
};

// lon/lat (degrees) to a point on the sphere. Matches three's SphereGeometry UVs
// so u = (lon + 180) / 360 and v = (lat + 90) / 180.
export function lonLatToVec3(lon, lat, r = GLOBE_R, target = new THREE.Vector3()) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return target.set(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

export function vec3ToLonLat(v) {
  const n = v.clone().normalize();
  const lat = 90 - THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)));
  let lon = THREE.MathUtils.radToDeg(Math.atan2(n.z, -n.x)) - 180;
  if (lon < -180) lon += 360;
  return { lon, lat };
}

// Equirectangular land mask with baked soft relief. Red = land amount, green = relief shade.
export function buildLandTexture(fc, width) {
  const w = width, h = width / 2;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  const proj = geoEquirectangular().fitExtent([[0, 0], [w, h]], { type: "Sphere" });
  const path = geoPath(proj, ctx);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  // Soft relief: a blurred inner glow so coasts read slightly raised and interiors settle.
  ctx.save();
  ctx.shadowColor = "rgba(0,255,0,1)";
  ctx.shadowBlur = w / 220;
  ctx.fillStyle = "rgb(255,120,0)";
  for (const f of fc.features) { ctx.beginPath(); path(f); ctx.fill(); }
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

const polygonsOf = (g) => (g?.type === "Polygon" ? [g.coordinates] : g?.type === "MultiPolygon" ? g.coordinates : []);

// All coastlines as one merged line segment buffer slightly above the surface (one draw call).
export function buildCoastGeometry(fc, r = GLOBE_R * 1.0015) {
  const segs = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const f of fc.features) {
    for (const poly of polygonsOf(f.geometry)) {
      for (const ring of poly) {
        for (let i = 0; i < ring.length - 1; i++) {
          const [lon0, lat0] = ring[i], [lon1, lat1] = ring[i + 1];
          if (Math.abs(lon1 - lon0) > 180) continue; // skip antimeridian jumps
          lonLatToVec3(lon0, lat0, r, a); lonLatToVec3(lon1, lat1, r, b);
          segs.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(segs, 3));
  return g;
}
