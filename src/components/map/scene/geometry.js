import * as THREE from "three";
import { geoArea } from "d3-geo";

// d3-geo treats a polygon whose exterior ring is wound backwards as covering
// almost the whole sphere. Rewind any such polygon so its area is the smaller side.
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

// Scene space: x = projected px, y = -projected px (y up), z = height.
const projectRing = (projection, ring) => {
  const out = [];
  for (const c of ring) {
    const p = projection(c);
    if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) out.push(new THREE.Vector2(p[0], -p[1]));
  }
  return out;
};

const polygonsOf = (g) => (g?.type === "Polygon" ? [g.coordinates] : g?.type === "MultiPolygon" ? g.coordinates : []);

// One merged land geometry plus one merged coastline segment buffer.
export function buildLandGeometry(projection, fc) {
  const shapes = [];
  const segs = [];
  for (const f of fc.features) {
    for (const poly of polygonsOf(f.geometry)) {
      const rings = poly.map((r) => projectRing(projection, r)).filter((r) => r.length >= 3);
      if (!rings.length) continue;
      const outer = THREE.ShapeUtils.isClockWise(rings[0]) ? rings[0].slice().reverse() : rings[0];
      const shape = new THREE.Shape(outer);
      for (const hole of rings.slice(1)) shape.holes.push(new THREE.Path(hole));
      shapes.push(shape);
      for (const r of rings) {
        for (let i = 0; i < r.length; i++) {
          const a = r[i];
          const b = r[(i + 1) % r.length];
          segs.push(a.x, a.y, 0, b.x, b.y, 0);
        }
      }
    }
  }
  const land = new THREE.ShapeGeometry(shapes, 1);
  const coast = new THREE.BufferGeometry();
  coast.setAttribute("position", new THREE.Float32BufferAttribute(segs, 3));
  return { land, coast };
}

export function buildSphereGeometry(projection) {
  const pts = [];
  for (let lat = -90; lat <= 90; lat += 2) pts.push([180, lat]);
  for (let lat = 90; lat >= -90; lat -= 2) pts.push([-180, lat]);
  const ring = projectRing(projection, pts);
  const shape = new THREE.Shape(THREE.ShapeUtils.isClockWise(ring) ? ring.reverse() : ring);
  return new THREE.ShapeGeometry(shape, 1);
}
