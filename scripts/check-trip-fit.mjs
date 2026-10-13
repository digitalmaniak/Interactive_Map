// Node check: trip framing keeps every pin's ground point AND its label box inside the
// usable area (viewport minus the 350 px panel, minus overlay chrome, 80 px padding,
// extra 24 px on the left) at the trip tilt, with the group centred in that area.
// Chrome is the measured CSS layout: tab bar bottom at about 78 px, profile block about
// 68 px tall at the bottom left. Run: node scripts/check-trip-fit.mjs
import * as THREE from "three";
import { titleReservePx } from "../src/components/map/scene/mockA.js";
import { solveTripFit, makeFitCamera, placeCamera, projectPx, estimateLabelBox, LABEL_GAP_PX } from "../src/components/map/scene/tripFit.js";

const v = (lat, lon) => {
  const phi = THREE.MathUtils.degToRad(90 - lat), th = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
};
const fmt = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
const trips = {
  "Euro Enduro": [["Andermatt", 46.636, 8.594], ["Grands Montets", 45.9776, 6.9356], ["Courmayeur", 45.7969, 6.9686], ["Le Brévent", 45.933, 6.8455], ["Verbier", 46.0964, 7.2286], ["Le Tour", 46.0089, 6.9442], ["Zermatt", 46.0207, 7.7491], ["Saas-Grund", 46.1216, 7.9389], ["Saas-Fee", 46.1085, 7.9292], ["Malbun", 47.101, 9.608], ["Sölden", 46.9646, 11.0077], ["St. Anton am Arlberg", 47.1287, 10.2683]],
  Japan: [["Tokyo", 35.6762, 139.6503], ["Hokkaido", 42.8048, 140.6874]],
};
const PANEL = 350, FOV = 28, TILT = THREE.MathUtils.degToRad(48);
const CHROME_TOP = 78, CHROME_BOTTOM = 68;
// Bottom chrome is the larger of the profile block and the trip title block.
const padFor = (H) => ({ top: 80 + CHROME_TOP, right: 80, bottom: 80 + titleReservePx(H, CHROME_BOTTOM), left: 104 });
let PAD;
let failed = 0;
for (const [name, pins] of Object.entries(trips)) {
  const pts = pins.map(([, a, b]) => v(a, b));
  const labels = pins.map(([t, a, b]) => estimateLabelBox(t, fmt(a, b)));
  for (const [W, H] of [[1440, 900], [1280, 800], [1280, 742]]) {
    const off = PANEL / 2;
    PAD = padFor(H);
    const { n, D } = solveTripFit(pts, { W, H, offset: off, fov: FOV, tilt: TILT, pad: PAD, labels });
    const cam = placeCamera(makeFitCamera(FOV, W, H, off), n, D, TILT, 0);
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity, pinTop = Infinity;
    pts.forEach((p, i) => {
      const s = projectPx(cam, p, W, H);
      l = Math.min(l, s.x - labels[i].w / 2); r = Math.max(r, s.x + labels[i].w / 2);
      t = Math.min(t, s.y - LABEL_GAP_PX - labels[i].h); b = Math.max(b, s.y);
      pinTop = Math.min(pinTop, s.y);
    });
    const visW = W - PANEL;
    const inside = l >= PAD.left - 0.5 && r <= visW - PAD.right + 0.5 && t >= PAD.top - 0.5 && b <= H - PAD.bottom + 0.5;
    const cxA = (PAD.left + visW - PAD.right) / 2, cyA = (PAD.top + H - PAD.bottom) / 2;
    const dx = (l + r) / 2 - cxA, dy = (t + b) / 2 - cyA;
    const centred = Math.abs(dx) < 2 && Math.abs(dy) < 2;
    if (!inside || !centred) failed++;
    console.log(`${inside && centred ? "PASS" : "FAIL"} ${name} ${W}x${H} D=${D.toFixed(4)} label+pin bounds L${l.toFixed(0)} R${(visW - r).toFixed(0)} T${t.toFixed(0)} B${(H - b).toFixed(0)} (top pin at ${pinTop.toFixed(0)}px) centre off ${dx.toFixed(1)},${dy.toFixed(1)}`);
  }
}
process.exit(failed ? 1 : 0);
