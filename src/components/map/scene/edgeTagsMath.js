// Edge tags (Prism): pure placement math, no three.js scene state, so check-edge-tags runs in node.
export const EDGE = { max: 6, inset: 20, mergePx: 40, heightPx: 34, smoothMs: 120, fadeMs: 200 };
const R_KM = 6371;

/** Great-circle km between two unit vectors ({x,y,z}), rounded to the nearest 100. */
export function roundedKm(a, b) {
  const d = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  return Math.round((Math.acos(d) * R_KM) / 100) * 100;
}
export const kmText = (km) => `${km.toLocaleString("en-US")} km`;

/** Where a ray from c in direction d leaves rect r ({x0,y0,x1,y1}). */
export function edgePoint(c, d, r) {
  const len = Math.hypot(d.x, d.y) || 1, ux = d.x / len, uy = d.y / len;
  let t = Infinity;
  if (ux > 1e-9) t = Math.min(t, (r.x1 - c.x) / ux);
  if (ux < -1e-9) t = Math.min(t, (r.x0 - c.x) / ux);
  if (uy > 1e-9) t = Math.min(t, (r.y1 - c.y) / uy);
  if (uy < -1e-9) t = Math.min(t, (r.y0 - c.y) / uy);
  if (!Number.isFinite(t)) t = 0;
  return { x: c.x + ux * t, y: c.y + uy * t, angle: Math.atan2(uy, ux) };
}

/** Push a point out of a blocked box (the top-left stack) along the nearer free edge. */
export function avoidBox(p, box) {
  if (!box || p.x < box.x0 || p.x > box.x1 || p.y < box.y0 || p.y > box.y1) return p;
  return box.x1 - p.x < box.y1 - p.y ? { ...p, x: box.x1 } : { ...p, y: box.y1 };
}

/** Greedy merge: tags within mergePx become one "+N" tag at their mean, flying to their midpoint. */
/** Rough tag width in px (mono 11px), for overlap tests before the DOM is measured. */
export const estWidth = (t) => 34 + 7.2 * ((t.name || "").length + String(t.km ?? "").length + 4);
/** Long names are cut so a tag never spans half the screen. */
export const shortName = (s, max = 18) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}\u2026` : s);
const close = (a, b, mergePx) => {
  if (Math.hypot(a.x - b.x, a.y - b.y) < mergePx) return true;
  // Boxes centred on their edge points that would overlap also merge.
  const wa = a.w ?? 0, wb = b.w ?? 0;
  return Math.abs(a.x - b.x) < (wa + wb) / 2 && Math.abs(a.y - b.y) < EDGE.heightPx;
};
export function mergeTags(tags, mergePx = EDGE.mergePx) {
  const out = [];
  for (const t of tags) {
    const hit = out.find((o) => close(o, t, mergePx));
    if (!hit) { out.push({ ...t, members: [t] }); continue; }
    hit.members.push(t);
    const n = hit.members.length;
    hit.x = hit.members.reduce((a, m) => a + m.x, 0) / n;
    hit.y = hit.members.reduce((a, m) => a + m.y, 0) / n;
    hit.id = hit.members.map((m) => m.id).join("+");
    hit.w = 62;
  }
  return out.map((o) => (o.members.length > 1 ? { ...o, merged: true, label: `+${o.members.length}` } : o));
}
