import * as THREE from "three";

// Pure camera framing helpers (no React), shared by GlobeScene and tests.
// Globe radius is 1 R.

export function localFrame(n) {
  const north = new THREE.Vector3(0, 1, 0).addScaledVector(n, -n.y);
  if (north.lengthSq() < 1e-6) north.set(0, 0, -1);
  north.normalize();
  const east = new THREE.Vector3().crossVectors(north, n).normalize();
  return { north, east };
}

// Camera position for surface target n (unit), centre distance D, tilt from the normal
// and heading. Heading 0 leans the camera toward the south (looking north), as in mock C.
export function poseFor(n, D, tilt, heading, outPos) {
  const { north, east } = localFrame(n);
  const lean = north.multiplyScalar(-Math.cos(heading)).addScaledVector(east, -Math.sin(heading));
  const u = n.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(lean, Math.sin(tilt));
  const tu = n.dot(u);
  const s = -tu + Math.sqrt(Math.max(tu * tu - 1 + D * D, 0));
  return outPos.copy(n).addScaledVector(u, s);
}

// Nearest hit of a ray on the unit sphere, or null.
export function raySphere(ray, out = new THREE.Vector3()) {
  const o = ray.origin, d = ray.direction;
  const b = o.dot(d);
  const c = o.lengthSq() - 1;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t < 0) return null;
  return out.copy(o).addScaledVector(d, t);
}

// Camera matching the live one: full canvas W x H, projection centre shifted by
// `offset` px so the visible area is x in [0, W - 2 * offset], and down by `offsetY` px
// (mobile bottom sheet) so the visible area is y in [0, H - 2 * offsetY].
export function makeFitCamera(fov, W, H, offset, offsetY = 0) {
  const cam = new THREE.PerspectiveCamera(fov, W / H, 0.0001, 100);
  if (offset > 0.01 || offsetY > 0.01) cam.setViewOffset(W, H, offset, offsetY, W, H);
  cam.updateProjectionMatrix();
  return cam;
}

export function placeCamera(cam, n, D, tilt, heading) {
  poseFor(n, D, tilt, heading, cam.position);
  cam.up.set(0, 1, 0);
  cam.lookAt(n);
  cam.updateMatrixWorld();
  return cam;
}

export function projectPx(cam, p, W, H, out = new THREE.Vector2()) {
  const v = p.clone().project(cam);
  return out.set((v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H);
}

function pickGround(cam, x, y, W, H) {
  const rc = new THREE.Raycaster();
  rc.setFromCamera(new THREE.Vector2((x / W) * 2 - 1, -(y / H) * 2 + 1), cam);
  return raySphere(rc.ray);
}

// Label box above a pin, in screen px, matching .v2-pin-label: centred on the pin,
// bottom edge 10 px above it, 4 px padding. Width from the name (11 px caps, 0.22em
// tracking) and the mono coordinate line; height covers both lines.
export const LABEL_GAP_PX = 10;
export function estimateLabelBox(name = "", coord = "") {
  const nameW = String(name).length * 9.3;
  const coordW = String(coord).length * 6.3;
  return { w: Math.max(nameW, coordW) + 8, h: 36 };
}

// Iterative trip fit: frame the pins' ground points and their label boxes so the
// projected bounds sit centred in the usable area (left of the panel, inside the chrome
// insets) with `pad` px on every side, at the given tilt and heading.
// pad: number or { top, right, bottom, left } (chrome already added by the caller).
// labels: optional array of { w, h } per point, in screen px.
// Returns { n, D, box }.
export function solveTripFit(points, { W, H, offset = 0, offsetY = 0, fov, tilt, heading = 0, pad = 80, labels = null, minAlt = 0.00125, maxAlt = 2.2 }) {
  const P = typeof pad === "number" ? { top: pad, right: pad, bottom: pad, left: pad } : pad;
  const n = new THREE.Vector3();
  for (const p of points) n.add(p);
  if (n.lengthSq() < 1e-9) n.set(0, 0, 1);
  n.normalize();
  let alt = 0.3;
  const visW = W - 2 * offset, visH = H - 2 * offsetY;
  const availW = Math.max(visW - P.left - P.right, 40), availH = Math.max(visH - P.top - P.bottom, 40);
  const cx = P.left + availW / 2, cy = P.top + availH / 2;
  const cam = makeFitCamera(fov, W, H, offset, offsetY);
  const measure = () => {
    placeCamera(cam, n, 1 + alt, tilt, heading);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    points.forEach((p, i) => {
      const s = projectPx(cam, p, W, H);
      const lb = labels && labels[i];
      const hw = lb ? lb.w / 2 : 0;
      const top = lb ? s.y - LABEL_GAP_PX - lb.h : s.y;
      x0 = Math.min(x0, s.x - hw); x1 = Math.max(x1, s.x + hw);
      y0 = Math.min(y0, top); y1 = Math.max(y1, s.y);
    });
    return { x0, x1, y0, y1 };
  };
  const recentre = (box) => {
    // Rotate the look target so the ground under the bounds centre lands under the
    // usable-area centre (screen offsets map to ground through the tilted camera).
    const pb = pickGround(cam, (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, W, H);
    const pv = pickGround(cam, cx, cy, W, H);
    if (pb && pv) n.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(pv.normalize(), pb.normalize())).normalize();
  };
  let box = null;
  for (let iter = 0; iter < 60; iter++) {
    box = measure();
    const bx = (box.x0 + box.x1) / 2, by = (box.y0 + box.y1) / 2;
    const ratio = Math.max((box.x1 - box.x0) / availW, (box.y1 - box.y0) / availH, 1e-3);
    const err = Math.hypot(bx - cx, by - cy);
    if (err < 1 && Math.abs(ratio - 1) < 0.01) break;
    recentre(box);
    alt = THREE.MathUtils.clamp(alt * Math.pow(ratio, 0.8), minAlt, maxAlt);
  }
  // Final guard through the exact returned pose: everything must sit inside the usable
  // area. Re-centre and lift a little until it does.
  const inside = (b) => b.x0 >= P.left - 0.5 && b.x1 <= visW - P.right + 0.5 && b.y0 >= P.top - 0.5 && b.y1 <= visH - P.bottom + 0.5;
  box = measure();
  for (let k = 0; k < 80 && !inside(box) && alt < maxAlt; k++) {
    recentre(box);
    alt = Math.min(maxAlt, alt * 1.02);
    box = measure();
  }
  return { n, D: 1 + alt, box };
}
