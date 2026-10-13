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

// Equirectangular land mask with baked soft relief.
// R = land, G = relief (soft inland rise), B = ocean distance from coast (0 at coast).
export function buildLandTexture(fc, width) {
  const w = width, h = width / 2;
  const proj = geoEquirectangular().fitExtent([[0, 0], [w, h]], { type: "Sphere" });
  const layer = (draw) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const path = geoPath(proj, ctx);
    draw(ctx, path);
    return ctx.getImageData(0, 0, w, h).data;
  };
  const blur = Math.max(2, w / 300);
  // Land mask.
  const mask = layer((ctx, path) => {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    for (const f of fc.features) { ctx.beginPath(); path(f); ctx.fill(); }
  });
  // Relief: blurred land, so interiors rise and coasts sit low. Pre-shaded, no elevation data.
  const relief = layer((ctx, path) => {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    ctx.filter = `blur(${blur * 3}px)`;
    ctx.fillStyle = "#fff";
    for (const f of fc.features) { ctx.beginPath(); path(f); ctx.fill(); }
  });
  // Coast proximity on water: blurred land seen from the ocean side.
  const near = layer((ctx, path) => {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    ctx.filter = `blur(${blur}px)`;
    ctx.fillStyle = "#fff";
    for (const f of fc.features) { ctx.beginPath(); path(f); ctx.fill(); }
  });
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    // Canvas row 0 is north. Texture v = 0 is south, so flip rows.
    const y = Math.floor(i / w), x = i % w;
    const k = ((h - 1 - y) * w + x) * 4;
    out[k] = mask[j];
    out[k + 1] = relief[j];
    out[k + 2] = 255 - near[j];
    out[k + 3] = 255;
  }
  const tex = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
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
