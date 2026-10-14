// Labels, edge tags and dots react to a click only. If the pointer moves more than 4 px
// before release, the gesture is handed to the globe / trip controls: a pointerdown is
// replayed on the canvas at the original press point and the canvas captures the pointer,
// so the drag pans or orbits exactly like one that started on empty map.
export const DRAG_THROUGH_PX = 4;

export function dragThrough(e) {
  if (e.button > 0) return;
  const el = e.currentTarget;
  const canvas = el.closest(".v2-map, .globe-wrap")?.querySelector("canvas") || document.querySelector(".v2-map canvas") || document.querySelector("canvas");
  if (!canvas) return;
  const start = { x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType };
  delete el.dataset.dragged;
  const done = () => { window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", done, true); window.removeEventListener("pointercancel", done, true); };
  const move = (m) => {
    if (m.pointerId !== start.id || Math.hypot(m.clientX - start.x, m.clientY - start.y) <= DRAG_THROUGH_PX) return;
    done();
    el.dataset.dragged = "1"; // the click that follows the release is swallowed
    canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, composed: true, clientX: start.x, clientY: start.y, pointerId: start.id, pointerType: start.type, isPrimary: true, button: 0, buttons: 1 }));
    try { if (!canvas.hasPointerCapture(start.id)) canvas.setPointerCapture(start.id); } catch { /* pointer already gone */ }
    // Replay this move too so the controls see the first step.
    canvas.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, cancelable: true, composed: true, clientX: m.clientX, clientY: m.clientY, pointerId: start.id, pointerType: start.type, isPrimary: true, button: -1, buttons: 1 }));
  };
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", done, true);
  window.addEventListener("pointercancel", done, true);
}

/** onClick guard: true (and reset) when the press turned into a drag. */
export function wasDragged(e) {
  const el = e.currentTarget;
  if (el?.dataset?.dragged) { delete el.dataset.dragged; return true; }
  return false;
}
