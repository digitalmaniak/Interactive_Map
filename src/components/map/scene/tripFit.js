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
// `offset` px so the visible area is x in [0, W - 2 * offset].
export function makeFitCamera(fov, W, H, offset) {
  const cam = new THREE.PerspectiveCamera(fov, W / H, 0.0001, 100);
  if (offset > 0.01) cam.setViewOffset(W, H, offset, 0, W, H);
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

// Iterative trip fit: frame the pins' ground points (unit vectors) so their projected
// bounding box is centred in the visible area left of the panel, with `pad` px on every
// side, at the given tilt and heading. Returns { n, D, box }.
export function solveTripFit(points, { W, H, offset = 0, fov, tilt, heading = 0, pad = 80, minAlt = 0.00125, maxAlt = 2.2 }) {
  const n = new THREE.Vector3();
  for (const p of points) n.add(p);
  if (n.lengthSq() < 1e-9) n.set(0, 0, 1);
  n.normalize();
  let alt = 0.3;
  const visW = W - 2 * offset;
  const availW = Math.max(visW - 2 * pad, 40), availH = Math.max(H - 2 * pad, 40);
  const cx = visW / 2, cy = H / 2;
  const cam = makeFitCamera(fov, W, H, offset);
  let box = null;
  for (let iter = 0; iter < 40; iter++) {
    placeCamera(cam, n, 1 + alt, tilt, heading);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of points) {
      const s = projectPx(cam, p, W, H);
      x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y);
    }
    box = { x0, x1, y0, y1 };
    const bx = (x0 + x1) / 2, by = (y0 + y1) / 2;
    const ratio = Math.max((x1 - x0) / availW, (y1 - y0) / availH, 1e-3);
    const err = Math.hypot(bx - cx, by - cy);
    if (err < 1 && Math.abs(ratio - 1) < 0.01) break;
    // Re-centre: rotate the look target so the ground under the bbox centre lands under
    // the visible-area centre.
    const pb = pickGround(cam, bx, by, W, H);
    const pv = pickGround(cam, cx, cy, W, H);
    if (pb && pv) n.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(pv.normalize(), pb.normalize())).normalize();
    // Re-scale altitude toward the target fill (damped).
    alt = THREE.MathUtils.clamp(alt * Math.pow(ratio, 0.8), minAlt, maxAlt);
  }
  // Final guard through the exact returned pose: every pin must sit inside the padded
  // usable area. Re-centre and lift a little until it does (perspective at the trip tilt
  // pushes near pins down and outward, so the bbox estimate alone can miss by a few px).
  const inside = (b) => b.x0 >= pad && b.x1 <= visW - pad && b.y0 >= pad && b.y1 <= H - pad;
  const measure = () => {
    placeCamera(cam, n, 1 + alt, tilt, heading);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of points) {
      const s = projectPx(cam, p, W, H);
      x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y);
    }
    return { x0, x1, y0, y1 };
  };
  box = measure();
  for (let k = 0; k < 60 && !inside(box) && alt < maxAlt; k++) {
    const pb = pickGround(cam, (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, W, H);
    const pv = pickGround(cam, cx, cy, W, H);
    if (pb && pv) n.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(pv.normalize(), pb.normalize())).normalize();
    alt = Math.min(maxAlt, alt * 1.02);
    box = measure();
  }
  return { n, D: 1 + alt, box };
}
