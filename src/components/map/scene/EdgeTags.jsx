"use client";
// Edge tags: places off-screen or on the far side get a small tag on the nearest screen
// edge (arrow, name, km from the view centre). One useFrame computes everything and writes
// to the DOM through refs; React never re-renders per frame.
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { dragThrough, wasDragged } from "./dragThrough";
import { EDGE, avoidBox, edgePoint, estWidth, kmText, fitTags, mergeTags, roundedKm, shortName } from "./edgeTagsMath";

export function useEdgeTagsStore() {
  return useMemo(() => ({ els: [], targets: Array.from({ length: EDGE.max }, () => null), pos: Array.from({ length: EDGE.max }, () => null) }), []);
}

// Inside <Canvas>.
export function EdgeTagsDriver({ store, itemsRef, safe, reducedMotion, enabled = true }) {
  const { camera, size } = useThree();
  const tmp = useMemo(() => ({ c: new THREE.Vector3(), p: new THREE.Vector3(), h: new THREE.Vector3(), q: new THREE.Vector3() }), []);
  const last = useRef(0);
  const obs = useRef({ n: 0, rects: [] });
  useFrame(() => {
    const els = store.els;
    if (!els.length) return;
    const now = performance.now(), dt = Math.min(100, now - (last.current || now)); last.current = now;
    const hideAll = () => els.forEach((el, i) => { if (el) { el.classList.remove("is-on"); store.targets[i] = null; } });
    if (!enabled) { hideAll(); return; }
    const W = size.width, H = size.height;
    const r = { x0: EDGE.inset + (safe.left || 0), y0: EDGE.inset + (safe.top || 0), x1: W - EDGE.inset - (safe.right || 0), y1: H - EDGE.inset - (safe.bottom || 0) };
    const cam = tmp.c.copy(camera.position); const cl = cam.length(), cd = cam.clone().normalize();
    // Directions start at the view centre (screen centre, kept inside the safe rect).
    const center = { x: Math.min(r.x1, Math.max(r.x0, W / 2)), y: Math.min(r.y1, Math.max(r.y0, H / 2)) };
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
        // Far side: the place's actual direction from the view centre, i.e. the screen
        // direction of the great circle leaving the centre toward it (its bearing).
        const c0 = toScreen(cd);
        const q = tmp.h.copy(cd).lerp(p, 0.02);
        if (q.lengthSq() < 1e-8) q.set(0, 1, 0);
        const c1 = toScreen(q.normalize());
        dir = { x: c1.x - c0.x, y: c1.y - c0.y };
      }
      const e = avoidBox(edgePoint(center, dir, r), safe.block);
      const t = { id: it.pin.id, x: e.x, y: e.y, angle: e.angle, km: roundedKm(cd, p), name: shortName(it.text || "Place"), n: p.clone() };
      t.w = estWidth({ name: t.name, km: kmText(t.km) });
      tags.push(t);
    }
    tags.sort((a, b) => a.km - b.km);
    const close = mergeTags(tags.slice(0, EDGE.max * 2)).slice(0, EDGE.max);
    // Obstacles, refreshed every few frames in the tags' own coordinates: visible map labels
    // and the region readout (its last known box is kept, so tags don't jump when it shows).
    if (obs.current.n++ % 6 === 0) {
      const host = els.find(Boolean)?.offsetParent, hr = host?.getBoundingClientRect();
      const rel = (b) => ({ x0: b.left - hr.left, x1: b.right - hr.left, y0: b.top - hr.top, y1: b.bottom - hr.top });
      obs.current.rects = hr ? [...document.querySelectorAll(".v2-pin-label")].filter((el) => el.style.visibility !== "hidden" && Number(el.style.opacity || 1) > 0.05).map((el) => rel(el.getBoundingClientRect())) : [];
      const reg = document.querySelector(".v2-region");
      if (reg && hr) { const b = rel(reg.getBoundingClientRect()); obs.current.region = { x0: Math.min(b.x0, W / 2 - 120), x1: Math.max(b.x1, W / 2 + 120), y0: b.y0, y1: b.y1 }; }
      if (!obs.current.font && els[0]) {
        const n = els[0].querySelector(".v2-edge-name"), k = els[0].querySelector(".v2-edge-km");
        const cs = getComputedStyle(n), ck = getComputedStyle(k);
        obs.current.font = { name: `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, km: `${ck.fontWeight} ${ck.fontSize} ${ck.fontFamily}`, ls: parseFloat(cs.letterSpacing) || 0 };
        obs.current.ctx = document.createElement("canvas").getContext("2d");
      }
    }
    const region = obs.current.region || { x0: W / 2 - 120, x1: W / 2 + 120, y0: r.y0, y1: r.y0 + 48 };
    // Real text widths (canvas measureText with the tag's own fonts) plus arrow and padding.
    const f = obs.current.font, ctx = obs.current.ctx;
    const textW = (s, font) => { if (!ctx || !f) return 7.2 * s.length; ctx.font = font; return ctx.measureText(s).width + f.ls * s.length; };
    const widthOf = (t) => Math.ceil(40 + (t.merged ? textW(t.label, f?.name) : textW(t.name, f?.name) + 8 + textW(kmText(t.km), f?.km)));
    const merged = fitTags(close, [...obs.current.rects, region], r, widthOf);
    // Keep each place in the slot it had last frame so tags slide instead of swapping.
    const slots = Array(EDGE.max).fill(null), free = [];
    merged.forEach((t) => { const k = store.targets.findIndex((o, i) => o && o.id === t.id && !slots[i]); if (k >= 0) slots[k] = t; else free.push(t); });
    free.forEach((t) => { const k = slots.findIndex((s, i) => !s && !store.targets[i]); const k2 = k >= 0 ? k : slots.findIndex((s) => !s); if (k2 >= 0) { slots[k2] = t; store.pos[k2] = null; } });
    const a = reducedMotion ? 1 : 1 - Math.exp(-dt / EDGE.smoothMs);
    const goal = {};
    slots.forEach((t, i) => { if (t) goal[i] = t; });
    slots.forEach((t, i) => {
      const el = els[i]; if (!el) return;
      if (!t) { el.classList.remove("is-on"); store.targets[i] = null; return; }
      const g = goal[i];
      const prev = store.pos[i] || { x: g.cx, y: g.cy };
      const cx = prev.x + (g.cx - prev.x) * a, cy = prev.y + (g.cy - prev.y) * a;
      store.pos[i] = { x: cx, y: cy };
      const n = t.merged ? t.members.reduce((v, m) => v.add(m.n), new THREE.Vector3()).normalize() : t.n;
      store.targets[i] = { id: t.id, n };
      const label = t.merged ? t.label : t.name, dist = t.merged ? "" : kmText(t.km);
      if (el.dataset.label !== label + dist) {
        el.dataset.label = label + dist;
        el.querySelector(".v2-edge-name").textContent = label;
        el.querySelector(".v2-edge-km").textContent = dist;
        el.setAttribute("aria-label", t.merged ? `${t.members.length} places off screen` : `${t.name}, ${dist} away`);
      }
      el.style.width = `${g.w}px`;
      el.style.transform = `translate(${(cx - g.w / 2).toFixed(1)}px, ${(cy - g.h / 2).toFixed(1)}px)`;
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
          onPointerDown={dragThrough}
          onClick={(e) => { if (wasDragged(e)) return; const t = store.targets[i]; if (t) onFly(t.n.clone()); }}>
          <svg className="v2-edge-arrow" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h7M6.5 3l3 3-3 3" fill="none" stroke="#00E5FF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="v2-edge-name" />
          <span className="v2-edge-km" />
        </button>
      ))}
    </div>
  );
}
