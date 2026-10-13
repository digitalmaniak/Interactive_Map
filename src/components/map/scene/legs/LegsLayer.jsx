"use client";
/* eslint-disable react-hooks/immutability -- three.js objects are mutated imperatively inside useFrame by design */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
// three-stdlib's Line2 (the same one drei's <Line> uses) supports RGBA vertex colours,
// needed for the fly end fade and the wake fade.
import { Line2, LineGeometry, LineMaterial, LineSegments2, LineSegmentsGeometry } from "three-stdlib";
import { flyArc, surfacePath, surfaceLiftScale, flyScaleFor, FLY_TRIP_SCALE } from "./legGeometry";

// Journey legs on the globe (DESIGN.md "Leg mode styles", v1 build spec). All widths
// are screen px (LineMaterial). Every leg is cyan; the active leg (arriving at the
// current stop) is 1.5x wider at full opacity. Red-orange stays reserved for the stop.
const ROUTE = new THREE.Color("#5CC8E4");
const DRAW_MS = 900;
const WAKE_PX = 40;
const WAKE_HALF = THREE.MathUtils.degToRad(19.5);
const WAKE_HALF_CRUISE = Math.atan(Math.tan(WAKE_HALF) * 1.5);
const STYLE = {
  fly: { px: 1.5, alpha: 1, head: true, loopMs: 4000 },
  drive: { px: 1.25, alpha: 0.8, head: true, loopMs: 4000, chevronPx: 24 },
  train: { px: 1.5, alpha: 1, head: true, loopMs: 2500, tickPx: 10 },
  boat: { px: 1.25, alpha: 0.8, head: true, loopMs: 4000, dash: [6, 4], wake: WAKE_HALF },
  cruise: { px: 2, alpha: 1, head: true, loopMs: 5000, dash: [2, 6], wake: WAKE_HALF_CRUISE },
  walk: { px: 1, alpha: 0.6, head: false, dash: [1, 4] },
  other: { px: 1, alpha: 0.6, head: true, loopMs: 4000 },
};

function makeLine(points, colors, px, dashed) {
  const g = new LineGeometry();
  g.setPositions(points.flatMap((p) => [p.x, p.y, p.z]));
  g.setColors(colors, 4);
  const m = new LineMaterial({ linewidth: px, vertexColors: true, transparent: true, depthWrite: false, dashed: !!dashed, worldUnits: false });
  const l = new Line2(g, m);
  l.computeLineDistances();
  l.frustumCulled = false;
  return l;
}

function makeSegs(px) {
  const g = new LineSegmentsGeometry();
  const m = new LineMaterial({ linewidth: px, vertexColors: true, transparent: true, depthWrite: false, worldUnits: false });
  const l = new LineSegments2(g, m);
  l.frustumCulled = false;
  return l;
}

export default function LegsLayer({ legs, activePinId, tripBlend, reducedMotion, lite = false }) {
  const { camera, size } = useThree();
  const surfaceGroup = useRef();
  const flyGroup = useRef();
  const fxGroup = useRef();
  const st = useRef({ start: null, lastDeco: 0, camKey: "" });

  // Build lines once per leg set / active stop.
  const built = useMemo(() => {
    const out = [];
    for (const leg of legs || []) {
      const s = STYLE[leg.mode] || STYLE.drive;
      const active = activePinId != null && leg.toPinId === activePinId;
      const fly = leg.mode === "fly";
      const path = fly ? flyArc(leg.a.v, leg.b.v, { offsetDeg: leg.offsetDeg }) : { points: surfacePath(leg.a.v, leg.b.v), alpha: null };
      const baseA = active ? 1 : s.alpha;
      const colors = [];
      path.points.forEach((_, i) => colors.push(ROUTE.r, ROUTE.g, ROUTE.b, path.alpha ? (active ? Math.max(path.alpha[i], 0.4) : path.alpha[i] * baseA) : baseA));
      const line = makeLine(path.points, colors, s.px * (active ? 1.5 : 1), !!s.dash);
      line.renderOrder = fly ? 6 : 4;
      out.push({ leg, s, fly, active, line, points: path.points, arcScale: FLY_TRIP_SCALE });
    }
    return out;
  }, [legs, activePinId]);

  // Pinless endpoints (airports, stopovers) and cruise ports: 4 px hollow rings, no label.
  const rings = useMemo(() => {
    const seen = new Map();
    for (const { leg } of built) {
      for (const e of [leg.a, leg.b]) {
        if (e.pinned && leg.mode !== "cruise") continue;
        const k = `${e.lat.toFixed(3)},${e.lon.toFixed(3)}`;
        if (!seen.has(k)) seen.set(k, e.v.clone());
      }
    }
    return [...seen.values()];
  }, [built]);

  const deco = useMemo(() => ({ chevrons: makeSegs(1), ticks: makeSegs(1), wakes: makeSegs(1) }), []);
  const heads = useRef();
  const ringMesh = useRef();
  const headMat = useMemo(() => new THREE.MeshBasicMaterial({ color: ROUTE.clone().multiplyScalar(lite ? 1 : 2), toneMapped: false, transparent: true, depthWrite: false }), [lite]);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: ROUTE, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }), []);

  useEffect(() => () => { for (const b of built) { b.line.geometry.dispose(); b.line.material.dispose(); } }, [built]);
  useEffect(() => () => { for (const d of Object.values(deco)) { d.geometry.dispose(); d.material.dispose(); } }, [deco]);
  useEffect(() => () => { headMat.dispose(); ringMat.dispose(); }, [headMat, ringMat]);
  useEffect(() => { st.current.start = null; }, [legs]);

  useFrame(() => {
    const now = performance.now();
    const s = st.current;
    const blend = tripBlend.current;
    const show = blend > 0.5 && built.length > 0;
    if (surfaceGroup.current) surfaceGroup.current.visible = show;
    if (flyGroup.current) flyGroup.current.visible = show;
    if (fxGroup.current) fxGroup.current.visible = show;
    if (!show) {
      s.start = null;
      if (typeof window !== "undefined") window.__legsDebug = { reducedMotion: !!reducedMotion, lite: !!lite, legCount: built.length, progress: 0, tripBlend: Number(blend.toFixed(3)), headRunning: false, heads: 0 };
      return;
    }
    // Draw-in starts once the camera has landed in trip view.
    if (s.start == null && blend >= 0.99) s.start = now;
    const progress = reducedMotion ? 1 : s.start == null ? 0 : Math.min(1, (now - s.start) / DRAW_MS);

    const alt = camera.position.length() - 1;
    // Fly arc height follows trip zoom. Same point count every time, so the full buffer is
    // rewritten in place (never resized) and instanceCount keeps driving the draw-in.
    const arcScale = flyScaleFor(alt);
    for (const b of built) {
      if (!b.fly || Math.abs(b.arcScale - arcScale) < 0.01) continue;
      const np = flyArc(b.leg.a.v, b.leg.b.v, { offsetDeg: b.leg.offsetDeg, scale: arcScale }).points;
      if (np.length !== b.points.length) continue;
      np.forEach((p, i) => b.points[i].copy(p));
      b.line.geometry.setPositions(np.flatMap((p) => [p.x, p.y, p.z]));
      b.arcScale = arcScale;
    }
    if (surfaceGroup.current) surfaceGroup.current.scale.setScalar(surfaceLiftScale(alt));
    const fovK = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / size.height; // world per px per unit distance
    const pxw = (p) => camera.position.distanceTo(p) * fovK;

    for (const b of built) {
      b.line.material.resolution.set(size.width, size.height);
      const n = b.points.length - 1;
      b.line.geometry.instanceCount = Math.max(0, Math.round(progress * n));
      if (b.s.dash) {
        // Dash pattern in screen px at the leg's middle distance.
        const w = pxw(b.points[Math.floor(n / 2)]);
        b.line.material.dashSize = b.s.dash[0] * w;
        b.line.material.gapSize = b.s.dash[1] * w;
      }
    }
    for (const d of Object.values(deco)) d.material.resolution.set(size.width, size.height);

    // Chevrons (drive) and sleeper ticks (train), spaced in screen px. Rebuilt at most
    // every 100 ms, and only when the camera moved or the draw-in is running.
    camera.updateMatrixWorld();
    const key = camera.matrixWorld.elements.map((x) => x.toFixed(4)).join(",");
    if ((key !== s.camKey || progress < 1) && now - s.lastDeco > 100) {
      s.camKey = key;
      s.lastDeco = now;
      const chev = [], chevC = [], tick = [], tickC = [];
      const T = new THREE.Vector3(), S = new THREE.Vector3(), P = new THREE.Vector3();
      for (const b of built) {
        const spacing = b.s.chevronPx || b.s.tickPx;
        if (!spacing || b.fly) continue;
        const pts = b.points, n = pts.length - 1, lim = progress * n;
        let carry = 0;
        for (let i = 0; i < n && i < lim; i++) {
          const a = pts[i], c = pts[i + 1];
          const segLen = a.distanceTo(c);
          T.copy(c).sub(a).normalize();
          let along = carry;
          while (along < segLen) {
            P.copy(a).addScaledVector(T, along);
            const w = pxw(P);
            S.copy(P).normalize().cross(T).normalize();
            if (b.s.chevronPx) {
              const back = P.clone().addScaledVector(T, -3 * w);
              for (const side of [1, -1]) {
                const q = back.clone().addScaledVector(S, side * 3 * w);
                chev.push(q.x, q.y, q.z, P.x, P.y, P.z);
                chevC.push(ROUTE.r, ROUTE.g, ROUTE.b, 0.6, ROUTE.r, ROUTE.g, ROUTE.b, 0.6);
              }
            } else {
              const l = P.clone().addScaledVector(S, 2.5 * w), r = P.clone().addScaledVector(S, -2.5 * w);
              tick.push(l.x, l.y, l.z, r.x, r.y, r.z);
              tickC.push(ROUTE.r, ROUTE.g, ROUTE.b, 0.9, ROUTE.r, ROUTE.g, ROUTE.b, 0.9);
            }
            along += spacing * w;
          }
          carry = along - segLen;
        }
      }
      setSegs(deco.chevrons, chev, chevC);
      setSegs(deco.ticks, tick, tickC);
    }

    // Moving heads (3 px, glowing) after the draw-in, plus boat and cruise wakes.
    const hm = heads.current;
    const wake = [], wakeC = [];
    const tmp = new THREE.Object3D();
    let h = 0;
    const headsOn = !reducedMotion && progress >= 1;
    for (const b of built) {
      if (!hm || !headsOn || !b.s.head) continue;
      const pts = b.points, n = pts.length - 1;
      const t = ((now - s.start - DRAW_MS) % b.s.loopMs) / b.s.loopMs;
      const f = t * n, i = Math.min(n - 1, Math.floor(f));
      const p = pts[i].clone().lerp(pts[i + 1], f - i);
      if (!b.fly) p.multiplyScalar(surfaceGroup.current ? surfaceGroup.current.scale.x : 1);
      const w = pxw(p);
      tmp.position.copy(p);
      tmp.quaternion.copy(camera.quaternion);
      tmp.scale.setScalar(1.5 * w * (b.active ? 1.3 : 1));
      tmp.updateMatrix();
      hm.setMatrixAt(h++, tmp.matrix);
      if (b.s.wake && !lite) {
        const T = pts[i + 1].clone().sub(pts[i]).normalize();
        const S = p.clone().normalize().cross(T).normalize();
        for (const side of [1, -1]) {
          const arm = T.clone().multiplyScalar(-Math.cos(b.s.wake)).addScaledVector(S, side * Math.sin(b.s.wake)).multiplyScalar(WAKE_PX * w);
          const q = p.clone().add(arm);
          wake.push(p.x, p.y, p.z, q.x, q.y, q.z);
          wakeC.push(ROUTE.r, ROUTE.g, ROUTE.b, 0.55, ROUTE.r, ROUTE.g, ROUTE.b, 0);
        }
      }
    }
    if (hm) { hm.count = h; hm.instanceMatrix.needsUpdate = true; }
    if (typeof window !== "undefined") {
      window.__legsDebug = { reducedMotion: !!reducedMotion, lite: !!lite, legCount: built.length, progress: Number(progress.toFixed(3)), tripBlend: Number(blend.toFixed(3)), headRunning: h > 0, heads: h };
    }
    setSegs(deco.wakes, wake, wakeC);

    // Rings face the camera at a constant 4 px.
    const rm = ringMesh.current;
    if (rm) {
      const k = surfaceGroup.current ? surfaceGroup.current.scale.x : 1;
      rings.forEach((v, i) => {
        tmp.position.copy(v).multiplyScalar(k);
        tmp.quaternion.copy(camera.quaternion);
        tmp.scale.setScalar(2 * pxw(tmp.position));
        tmp.updateMatrix();
        rm.setMatrixAt(i, tmp.matrix);
      });
      rm.instanceMatrix.needsUpdate = true;
    }
  });

  if (!built.length) return null;
  return (
    <group>
      <group ref={surfaceGroup}>
        {built.filter((b) => !b.fly).map((b) => <primitive key={b.line.uuid} object={b.line} />)}
        <primitive object={deco.chevrons} renderOrder={5} />
        <primitive object={deco.ticks} renderOrder={5} />
      </group>
      <group ref={flyGroup}>
        {built.filter((b) => b.fly).map((b) => <primitive key={b.line.uuid} object={b.line} />)}
      </group>
      <group ref={fxGroup}>
      <primitive object={deco.wakes} renderOrder={6} />
      <instancedMesh key={`h-${built.length}`} ref={heads} args={[undefined, headMat, built.length]} frustumCulled={false} raycast={() => null} renderOrder={7}>
        <circleGeometry args={[1, 16]} />
      </instancedMesh>
      {rings.length > 0 && (
        <instancedMesh key={`r-${rings.length}`} ref={ringMesh} args={[undefined, ringMat, rings.length]} frustumCulled={false} raycast={() => null} renderOrder={7}>
          <ringGeometry args={[0.7, 1, 24]} />
        </instancedMesh>
      )}
      </group>
    </group>
  );
}

function setSegs(obj, pos, col) {
  if (!pos.length) { obj.visible = false; return; }
  obj.visible = true;
  obj.geometry.dispose();
  const g = new LineSegmentsGeometry();
  g.setPositions(pos);
  g.setColors(col, 4);
  obj.geometry = g;
}
