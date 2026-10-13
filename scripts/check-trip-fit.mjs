// Node check: trip framing keeps every pin's ground point inside the usable area
// (viewport minus the 350 px panel, 80 px padding on every side) at the trip tilt,
// and the group is centred in that area. Run: node scripts/check-trip-fit.mjs
import * as THREE from "three";
import { solveTripFit, makeFitCamera, placeCamera, projectPx } from "../src/components/map/scene/tripFit.js";

const v = (lat, lon) => {
  const phi = THREE.MathUtils.degToRad(90 - lat), th = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
};
const trips = {
  "Euro Enduro": [[46.636, 8.594], [45.9776, 6.9356], [45.7969, 6.9686], [45.933, 6.8455], [46.0964, 7.2286], [46.0089, 6.9442], [46.0207, 7.7491], [46.1216, 7.9389], [46.1085, 7.9292], [47.101, 9.608], [46.9646, 11.0077], [47.1287, 10.2683]],
  Japan: [[35.6762, 139.6503], [42.8048, 140.6874]],
};
const PANEL = 350, PAD = 80, FOV = 28, TILT = THREE.MathUtils.degToRad(48);
let failed = 0;
for (const [name, pins] of Object.entries(trips)) {
  const pts = pins.map(([a, b]) => v(a, b));
  for (const [W, H] of [[1440, 900], [1280, 800]]) {
    const off = PANEL / 2;
    const { n, D } = solveTripFit(pts, { W, H, offset: off, fov: FOV, tilt: TILT, pad: PAD });
    // Independent check through the final pose.
    const cam = placeCamera(makeFitCamera(FOV, W, H, off), n, D, TILT, 0);
    const xs = [], ys = [];
    for (const p of pts) { const s = projectPx(cam, p, W, H); xs.push(s.x); ys.push(s.y); }
    const box = { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
    const visW = W - PANEL;
    const inside = box.l >= PAD - 0.5 && box.r <= visW - PAD + 0.5 && box.t >= PAD - 0.5 && box.b <= H - PAD + 0.5;
    const dx = (box.l + box.r) / 2 - visW / 2, dy = (box.t + box.b) / 2 - H / 2;
    const centred = Math.abs(dx) < 2 && Math.abs(dy) < 2;
    if (!inside || !centred) failed++;
    console.log(`${inside && centred ? "PASS" : "FAIL"} ${name} ${W}x${H} D=${D.toFixed(4)} margins L${box.l.toFixed(0)} R${(visW - box.r).toFixed(0)} T${box.t.toFixed(0)} B${(H - box.b).toFixed(0)} centre off ${dx.toFixed(1)},${dy.toFixed(1)}`);
  }
}
process.exit(failed ? 1 : 0);
