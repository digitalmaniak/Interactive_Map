"use client";
// Edge tags: places off-screen or on the far side get a small tag on the nearest screen
// edge (arrow, name, km from the view centre). One useFrame computes everything and writes
// to the DOM through refs; React never re-renders per frame.
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { EDGE, avoidBox, edgePoint, estWidth, kmText, mergeTags, roundedKm, shortName } from "./edgeTagsMath";

export function useEdgeTagsStore() {
  return useMemo(() => ({ els: [], targets: Array.from({ length: EDGE.max }, () => null), pos: Array.from({ length: EDGE.max }, () => null) }), []);
}

// Inside <Canvas>.
export function EdgeTagsDriver({ store, itemsRef, safe, reducedMotion, enabled = true }) {
  const { camera, size } = useThree();
  const tmp = useMemo(() => ({ c: new THREE.Vector3(), p: new THREE.Vector3(), h: new THREE.Vector3(), q: new THREE.Vector3() }), []);
  const last = useRef(0);
  useFrame(() => {
    const els = store.els;
    if (!els.length) return;
    const now = performance.now(), dt = Math.min(100, now - (last.current || now)); last.current = now;
    const hideAll = () => els.forEach((el, i) => { if (el) { el.classList.remove("is-on"); store.targets[i] = null; } });
    if (!enabled) { hideAll(); return; }
    const W = size.width, H = size.height;
    const r = { x0: EDGE.inset + (safe.left || 0), y0: EDGE.inset + (safe.top || 0), x1: W - EDGE.inset - (safe.right || 0), y1: H - EDGE.inset - (safe.bottom || 0) };
    const cam = tmp.c.copy(camera.position); const cl = cam.length(), cd = cam.clone().normalize();
    const center = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
    const horizon = 1 / cl; // a unit point is in front when p . cd > 1/|cam|
    const toScreen = (v) => { const q = tmp.q.copy(v).project(camera); return { x: (q.x + 1) / 2 * W, y: (1 - q.y) / 2 * H }; };
    const tags = [];
    for (const it of itemsRef.current || []) {
      if (it.dimmed) continue;
      const p = tmp.p.copy(it.pos).normalize();
      const front = p.dot(cd) > horizon + 0.002;
      let s = null, dir;
      if (front) {
        s = toScreen(p);
        if (s.x >= r.x0 && s.x <= r.x1 && s.y >= r.y0 && s.y <= r.y1) continue; // visible: no tag
        dir = { x: s.x - center.x, y: s.y - center.y };
      } else {
        // Far side: point toward the nearest horizon.
        const perp = tmp.h.copy(p).addScaledVector(cd, -p.dot(cd));
        if (perp.lengthSq() < 1e-8) perp.set(0, 1, 0);
        perp.normalize();
        const hp = cd.clone().multiplyScalar(horizon).addScaledVector(perp, Math.sqrt(Math.max(0, 1 - horizon * horizon)));
        const hs = toScreen(hp);
        dir = { x: hs.x - center.x, y: hs.y - center.y };
      }
      const e = avoidBox(edgePoint(center, dir, r), safe.block);
      const t = { id: it.pin.id, x: e.x, y: e.y, angle: e.angle, km: roundedKm(cd, p), name: shortName(it.text || "Place"), n: p.clone() };
      t.w = estWidth({ name: t.name, km: kmText(t.km) });
      tags.push(t);
    }
    tags.sort((a, b) => a.km - b.km);
    const merged = mergeTags(tags.slice(0, EDGE.max * 2)).slice(0, EDGE.max);
    // Keep each place in the slot it had last frame so tags slide instead of swapping.
    const slots = Array(EDGE.max).fill(null), free = [];
    merged.forEach((t) => { const k = store.targets.findIndex((o, i) => o && o.id === t.id && !slots[i]); if (k >= 0) slots[k] = t; else free.push(t); });
    free.forEach((t) => { const k = slots.findIndex((s, i) => !s && !store.targets[i]); const k2 = k >= 0 ? k : slots.findIndex((s) => !s); if (k2 >= 0) { slots[k2] = t; store.pos[k2] = null; } });
    const a = reducedMotion ? 1 : 1 - Math.exp(-dt / EDGE.smoothMs);
    slots.forEach((t, i) => {
      const el = els[i]; if (!el) return;
      if (!t) { el.classList.remove("is-on"); store.targets[i] = null; return; }
      const prev = store.pos[i] || { x: t.x, y: t.y };
      const x = prev.x + (t.x - prev.x) * a, y = prev.y + (t.y - prev.y) * a;
      store.pos[i] = { x, y };
      const n = t.merged ? t.members.reduce((v, m) => v.add(m.n), new THREE.Vector3()).normalize() : t.n;
      store.targets[i] = { id: t.id, n };
      const label = t.merged ? t.label : t.name, dist = t.merged ? "" : kmText(t.km);
      if (el.dataset.label !== label + dist) {
        el.dataset.label = label + dist;
        el.querySelector(".v2-edge-name").textContent = label;
        el.querySelector(".v2-edge-km").textContent = dist;
        el.setAttribute("aria-label", t.merged ? `${t.members.length} places off screen` : `${t.name}, ${dist} away`);
      }
      // Centre the tag on the edge point, kept inside the safe rect.
      const w = el.offsetWidth || 120;
      const cx = Math.min(r.x1 - w / 2, Math.max(r.x0 + w / 2, x));
      const cy = Math.min(r.y1 - EDGE.heightPx / 2, Math.max(r.y0 + EDGE.heightPx / 2, y));
      el.style.transform = `translate(${(cx - w / 2).toFixed(1)}px, ${(cy - EDGE.heightPx / 2).toFixed(1)}px)`;
      el.querySelector(".v2-edge-arrow").style.transform = `rotate(${t.angle.toFixed(3)}rad)`;
      el.classList.add("is-on");
    });
  });
  return null;
}

// Outside <Canvas>: the tag nodes. Clicking flies the camera there (existing controller).
export function EdgeTagsLayer({ store, onFly }) {
  return (
    <div className="v2-edge-tags">
      {Array.from({ length: EDGE.max }, (_, i) => (
        <button key={i} type="button" className="v2-edge-tag" ref={(el) => { store.els[i] = el; }}
          onClick={() => { const t = store.targets[i]; if (t) onFly(t.n.clone()); }}>
          <svg className="v2-edge-arrow" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h7M6.5 3l3 3-3 3" fill="none" stroke="#00E5FF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="v2-edge-name" />
          <span className="v2-edge-km" />
        </button>
      ))}
    </div>
  );
}
