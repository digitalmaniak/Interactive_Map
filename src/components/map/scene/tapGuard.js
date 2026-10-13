// Tap guard for globe clicks: a click only counts as a tap (start an entry, exit a trip)
// when the pointer moved under TAP.maxPx, the press lasted under TAP.maxMs, only one
// pointer took part in the gesture (no pinch), and the mobile sheet is not animating.
export const TAP = { maxPx: 6, maxMs: 300, sheetSettleMs: 350 };

export function makeTapGuard(now = () => performance.now()) {
  const downs = new Map();
  let g = null; // { x0, y0, t0, maxD, multi, upT }
  let sheetChangedAt = -Infinity;
  return {
    down(id, x, y) {
      if (downs.size === 0) g = { x0: x, y0: y, t0: now(), maxD: 0, multi: false, upT: null };
      downs.set(id, true);
      if (downs.size > 1 && g) g.multi = true;
    },
    move(id, x, y) {
      if (!downs.has(id) || !g) return;
      g.maxD = Math.max(g.maxD, Math.hypot(x - g.x0, y - g.y0));
    },
    up(id, x, y) {
      if (!downs.has(id)) return;
      if (g && x != null) g.maxD = Math.max(g.maxD, Math.hypot(x - g.x0, y - g.y0));
      downs.delete(id);
      if (downs.size === 0 && g) g.upT = now();
    },
    sheetChanged() { sheetChangedAt = now(); },
    isTap() {
      if (!g || downs.size > 0) return false;
      const end = g.upT ?? now();
      if (g.multi || g.maxD >= TAP.maxPx || end - g.t0 >= TAP.maxMs) return false;
      if (now() - sheetChangedAt < TAP.sheetSettleMs) return false;
      return true;
    },
  };
}
