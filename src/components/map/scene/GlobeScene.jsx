"use client";
/* eslint-disable react-hooks/immutability -- three.js objects (camera, controls, uniforms) are mutated imperatively inside useFrame by design */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { geoContains } from "d3-geo";
import { GLOBE_R, rewindGeo, lonLatToVec3, vec3ToLonLat, buildLandTexture, buildCoastGeometry } from "./geometry";
import { createGlobeMaterial, createAtmosphereMaterial, createBeamMaterial } from "./GlobeMaterial";
import { tokens, tiers, bezier } from "./tokens";
import { detectRenderTier } from "./renderTier";
import { supabase } from "../../../lib/supabase/client";
import FpsGuard from "./FpsGuard";
import StaticGlobe from "./StaticGlobe";

// v2 main view (DESIGN.md v2: mock A globe, mock C trip framing).
// One perspective camera orbiting a sphere. Draw calls stay tiny for phones:
// globe, atmosphere, coastline, marker dots, beams (5) plus bloom passes when the tier allows.

const C = tokens.color;
const CAM = tokens.camera;
const HOME_DIST = CAM.keyframes[0].distR;
const MIN_DIST = 1.08;
// Trip view lets the camera come about 3x closer to the surface than MIN_DIST.
const TRIP_MIN_DIST = GLOBE_R + (MIN_DIST - GLOBE_R) / 3;
const MAX_DIST = 6;
const LABEL_DIST = 1.9;
const DRAG_PX = 5;
const easeOpen = bezier(CAM.open.ease);
const easeLag = bezier(CAM.open.fovTiltEase);
const easeClose = bezier(CAM.close.ease);
const easeGrow = bezier([0.16, 1, 0.3, 1]);

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

// Boot tier pick. Cheap heuristic (no extra GPU probe dependency): touch devices are
// phones, low core or memory counts drop to the low tier. PerformanceMonitor can drop further.
function pickTier() {
  if (typeof window === "undefined") return "desktop";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (!coarse) return "desktop";
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  return cores >= 6 && mem >= 4 ? "phoneHigh" : "phoneLow";
}

// Keyframe lookup with distance interpolated in log space.
function sampleKeys(t, fitDist) {
  const ks = CAM.keyframes;
  let i = 0;
  while (i < ks.length - 2 && t > ks[i + 1].t) i++;
  const a = ks[i], b = ks[i + 1];
  const u = THREE.MathUtils.clamp((t - a.t) / (b.t - a.t), 0, 1);
  const da = a.distR === "fit" ? fitDist : a.distR;
  const db = b.distR === "fit" ? fitDist : b.distR;
  return {
    fov: THREE.MathUtils.lerp(a.fov, b.fov, u),
    dist: Math.exp(THREE.MathUtils.lerp(Math.log(da), Math.log(db), u)),
    tilt: THREE.MathUtils.degToRad(THREE.MathUtils.lerp(a.tiltDeg, b.tiltDeg, u)),
  };
}

// Camera pose for a surface target n (unit), centre distance D and tilt from the normal.
// Tilt leans the camera toward the south along the local meridian (mock C framing).
function poseFor(n, D, tilt, outPos) {
  const north = new THREE.Vector3(0, 1, 0).addScaledVector(n, -n.y);
  if (north.lengthSq() < 1e-6) north.set(0, 0, -1);
  north.normalize();
  const u = n.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(north, -Math.sin(tilt));
  const tu = n.dot(u);
  const s = -tu + Math.sqrt(Math.max(tu * tu - 1 + D * D, 0));
  return outPos.copy(n).multiplyScalar(GLOBE_R).addScaledVector(u, s);
}

function tripFraming(points) {
  const c = new THREE.Vector3();
  for (const p of points) c.add(lonLatToVec3(p.lon, p.lat));
  if (c.lengthSq() < 1e-6) c.set(0, 0, 1);
  c.normalize();
  let spread = 0;
  for (const p of points) spread = Math.max(spread, c.angleTo(lonLatToVec3(p.lon, p.lat)));
  // Fit to bounds, roughly 1.08 to 1.25 R for a typical trip, wider for spread out journeys.
  const fit = THREE.MathUtils.clamp(1.08 + spread * 1.4, 1.08, 2.2);
  return { n: c, fit };
}

function Globe({ geo, tier, onGlobeClick, onGlobeHover, tripView }) {
  const { gl, size } = useThree();
  const t = tiers[tier];
  const { material, atmo, coast, tex } = useMemo(() => {
    const max = gl.capabilities.maxTextureSize || 4096;
    const tx = buildLandTexture(geo, Math.min(t.maskW, max));
    return { tex: tx, material: createGlobeMaterial(tx), atmo: createAtmosphereMaterial(), coast: buildCoastGeometry(geo) };
  }, [geo, gl, t.maskW]);
  useEffect(() => () => { material.dispose(); atmo.dispose(); coast.dispose(); tex.dispose(); }, [material, atmo, coast, tex]);
  useFrame(() => {
    material.uniforms.uDpr.value = gl.getPixelRatio();
    const target = tripView.current ? tokens.hatch.spacingPx.trip : tokens.hatch.spacingPx.globe;
    material.uniforms.uHatchSpacing.value += (target - material.uniforms.uHatchSpacing.value) * 0.1;
  });
  void size;
  return (
    <group>
      <mesh
        material={material}
        onClick={(e) => { if (e.delta > DRAG_PX) return; onGlobeClick(e.point); }}
        onPointerMove={(e) => onGlobeHover(e.point)}
        onPointerOut={() => onGlobeHover(null)}
      >
        <sphereGeometry args={[GLOBE_R, t.globeSeg[0], t.globeSeg[1]]} />
      </mesh>
      <mesh material={atmo} scale={1.015} raycast={() => null}>
        <sphereGeometry args={[GLOBE_R, 64, 32]} />
      </mesh>
      <lineSegments geometry={coast} raycast={() => null}>
        <lineBasicMaterial color={C.coast} transparent opacity={C.coastOpacity} />
      </lineSegments>
    </group>
  );
}

// Stop dots (one InstancedMesh) and stop beams (one InstancedMesh).
// Route colours are pushed above 1 (emissive 1.6, accent 2.0) so only they cross the bloom threshold.
function Stops({ items, activePinId, hoveredPinId, onSelect, onHover, reducedMotion }) {
  const dots = useRef();
  const beams = useRef();
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const beamMat = useMemo(() => createBeamMaterial(), []);
  const beamGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    const n = Math.max(items.length, 1);
    g.setAttribute("aColor", new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aAlpha", new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    return g;
  }, [items.length]);
  useEffect(() => () => beamMat.dispose(), [beamMat]);
  useEffect(() => () => beamGeo.dispose(), [beamGeo]);
  const growStart = useRef(null);
  useEffect(() => { growStart.current = null; }, [items]);
  const { camera } = useThree();

  useFrame(() => {
    const d = dots.current, b = beams.current;
    if (!d || !b) return;
    const dist = camera.position.length() - GLOBE_R;
    const px = THREE.MathUtils.clamp(dist * 0.0055, 0.0007, 0.02); // ~6 px disc
    if (growStart.current == null) growStart.current = performance.now();
    const g = reducedMotion ? 1 : easeGrow(Math.min(1, (performance.now() - growStart.current) / tokens.beam.growMs));
    const tripish = THREE.MathUtils.clamp((2.4 - camera.position.length()) / 1.2, 0, 1);
    beamMat.uniforms.uGrow.value = g;
    beamMat.uniforms.uHeight.value = THREE.MathUtils.lerp(tokens.beam.heightR.globe, tokens.beam.heightR.trip, tripish) * (dist < 0.5 ? dist / 0.5 + 0.15 : 1);
    beamMat.uniforms.uWidth.value = 0.0012;
    const aColor = beamGeo.getAttribute("aColor");
    const aAlpha = beamGeo.getAttribute("aAlpha");
    items.forEach((it, i) => {
      const active = it.pin.id === activePinId;
      const hover = it.pin.id === hoveredPinId;
      tmp.position.copy(it.pos);
      tmp.lookAt(it.pos.clone().multiplyScalar(2));
      const s = px * (active ? 1.5 : hover ? 1.25 : 1);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      d.setMatrixAt(i, tmp.matrix);
      b.setMatrixAt(i, tmp.matrix);
      col.set(active ? C.accent : C.route).multiplyScalar(active ? tokens.glow.emissive.accent : tokens.glow.emissive.route);
      if (it.dimmed) col.set(C.route).multiplyScalar(0.25);
      d.setColorAt(i, col);
      aColor.setXYZ(i, col.r, col.g, col.b);
      aAlpha.setX(i, it.dimmed ? 0 : 1);
    });
    d.instanceMatrix.needsUpdate = true;
    if (d.instanceColor) d.instanceColor.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true;
    aColor.needsUpdate = true;
    aAlpha.needsUpdate = true;
  });

  if (!items.length) return null;
  return (
    <group>
      <instancedMesh key={`b-${items.length}`} ref={beams} args={[beamGeo, beamMat, items.length]} raycast={() => null} frustumCulled={false} />
      <instancedMesh
        key={`d-${items.length}`}
        ref={dots}
        args={[undefined, undefined, items.length]}
        frustumCulled={false}
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta > DRAG_PX) return;
          const it = items[e.instanceId];
          if (it && !it.dimmed) onSelect(it.pin);
        }}
        onPointerOver={(e) => { e.stopPropagation(); const it = items[e.instanceId]; if (it && !it.dimmed) onHover(it.pin); }}
        onPointerOut={() => onHover(null)}
      >
        <circleGeometry args={[1, 20]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// Globe to trip and back (DESIGN.md camera table). Controls are disabled while tweening
// and re-enabled after the settle. Reduced motion: instant cut to the end keyframe.
// Journals panel offset: shift the projection centre (not the canvas) so the globe
// or the framed trip sits centred in the space left of the panel. Eased with the
// camera move tokens (1600 ms open, 1200 ms close). No offset when the panel would
// cover most of the screen (narrow / mobile).
export const panelOffsetFor = (open, width, panelWidth) =>
  open && width > panelWidth * 1.6 ? panelWidth / 2 : 0;

function ViewOffset({ panelOpen, panelWidth, reducedMotion, viewRef }) {
  const { camera, size } = useThree();
  const st = useRef({ cur: 0, from: 0, to: 0, t0: 0, open: true, w: 0, h: 0, applied: null });
  useFrame(() => {
    const s = st.current;
    const target = panelOffsetFor(panelOpen, size.width, panelWidth);
    viewRef.current = { width: size.width, height: size.height, offset: target };
    const now = performance.now();
    if (target !== s.to) {
      s.from = s.cur; s.to = target; s.t0 = now; s.open = target > s.from;
    }
    if (s.cur !== s.to) {
      const dur = s.open ? CAM.open.ms : CAM.close.ms;
      const raw = reducedMotion ? 1 : Math.min(1, (now - s.t0) / dur);
      const e = s.open ? easeOpen(raw) : easeClose(raw);
      s.cur = raw >= 1 ? s.to : s.from + (s.to - s.from) * e;
    }
    const key = `${s.cur.toFixed(2)}|${size.width}|${size.height}`;
    if (key === s.applied) return;
    s.applied = key;
    if (s.cur > 0.01) camera.setViewOffset(size.width, size.height, s.cur, 0, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  });
  return null;
}

// Trip fit for the visible area left of the panel: a narrower view needs more altitude.
function fitForView(fit, view) {
  if (!view || !view.offset || !view.height) return fit;
  const availAspect = (view.width - 2 * view.offset) / view.height;
  if (availAspect >= 1) return fit;
  const scale = Math.min(1.8, 1 / Math.max(availAspect, 0.3));
  return 1 + (fit - 1) * scale;
}

function CameraDirector({ controlsRef, moveRef, reducedMotion, tripView, onArrive }) {
  const { camera } = useThree();
  const anim = useRef(null);
  const seen = useRef(null);
  const idleUntil = useRef(0);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    const alt = camera.position.length() - GLOBE_R;
    if (controls) {
      controls.rotateSpeed = THREE.MathUtils.clamp(alt * 0.35, 0.03, 0.5);
      controls.minDistance = tripView.current ? TRIP_MIN_DIST : MIN_DIST;
    }
    // Near plane follows altitude (about 0.1 x altitude) so near ground lines keep depth precision.
    const near = THREE.MathUtils.clamp(alt * 0.1, 0.0005, 0.05);
    if (Math.abs(near - camera.near) > camera.near * 0.05) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    const req = moveRef.current;
    if (req !== seen.current) {
      seen.current = req;
      anim.current = null;
      if (req) {
        const fromN = (controls && controls.target.lengthSq() > 1e-6 ? controls.target : camera.position).clone().normalize();
        const a = { req, fromN, fromPos: camera.position.clone(), fromTarget: controls ? controls.target.clone() : new THREE.Vector3(), fromFov: camera.fov, t0: performance.now() };
        if (reducedMotion) a.t0 = -Infinity;
        anim.current = a;
        if (controls) controls.enabled = false;
      }
    }

    const a = anim.current;
    if (!a) {
      // Idle drift on the globe view, paused while the user interacts.
      if (controls && !tripView.current && !reducedMotion && performance.now() > idleUntil.current && controls.enabled) {
        const yaw = THREE.MathUtils.degToRad(CAM.idleYawDegPerSec) * delta;
        camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        controls.update();
      }
      return;
    }

    const goal = a.req;
    const open = goal.kind === "open";
    const dur = open ? CAM.open.ms : CAM.close.ms;
    const elapsed = performance.now() - a.t0;
    const raw = Math.min(1, elapsed / dur);
    const rawLag = Math.min(1, Math.max(0, (elapsed - (open ? CAM.open.fovTiltLagMs : 0)) / dur));
    const e = open ? easeOpen(raw) : easeClose(raw);
    const eLag = open ? easeLag(rawLag) : easeClose(raw);

    // Keyframe parameter: open runs 0 to 1, close runs 1 to 0 (tilt reaches 0 by 60 percent).
    const k = open ? e : 1 - e;
    const kLag = open ? eLag : 1 - Math.min(1, raw / 0.6);
    const key = sampleKeys(k, goal.fit);
    const tiltKey = sampleKeys(kLag, goal.fit);

    // Slerp the surface target, then build the pose.
    const n = new THREE.Vector3().copy(a.fromN).lerp(goal.n, e).normalize();
    if (n.lengthSq() < 1e-6) n.copy(goal.n);
    let dist = key.dist;
    if (raw >= 1 && open) {
      // Settle: 1.5 percent overshoot damped back over 400 ms.
      const st = Math.min(1, (elapsed - dur) / CAM.settle.ms);
      dist *= 1 + CAM.settle.overshoot * Math.sin(Math.PI * st) * (1 - st);
    }
    const pos = poseFor(n, dist, tiltKey.tilt, new THREE.Vector3());
    camera.position.copy(pos);
    camera.fov = open ? THREE.MathUtils.lerp(a.fromFov, tiltKey.fov, eLag) : key.fov;
    camera.updateProjectionMatrix();
    // Look target moves from the globe centre to the surface point as tilt grows.
    const look = n.clone().multiplyScalar(GLOBE_R * THREE.MathUtils.clamp(k * 1.4, 0, 1));
    if (controls) { controls.target.copy(look); controls.update(); }
    else camera.lookAt(look);

    const settleDone = !open || elapsed >= dur + CAM.settle.ms || reducedMotion;
    if (raw >= 1 && settleDone) {
      anim.current = null;
      tripView.current = open;
      if (controls) {
        controls.enabled = true;
        if (!open) { controls.target.set(0, 0, 0); controls.update(); }
      }
      onArrive?.(open);
    }
  });

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const pause = () => { idleUntil.current = Infinity; };
    const resume = () => { idleUntil.current = performance.now() + CAM.idleResumeMs; };
    c.addEventListener("start", pause);
    c.addEventListener("end", resume);
    return () => { c.removeEventListener("start", pause); c.removeEventListener("end", resume); };
  });
  return null;
}

// HTML labels above the canvas, positioned each frame without React re-renders.
// Overlap rule (DESIGN.md, Label overlap rule v1): place labels by priority, hide any
// that overlap a placed one (beam and dot stay), merge pins within 28 px into one mono
// cluster label. Placement recomputes only while the camera moves, at most every 100 ms.
const CLUSTER_PX = 28;
const LABEL_PAD = 6;
const LABEL_RECOMPUTE_MS = 100;
const LABEL_RETURN_MS = 200;
const FACING_MIN = Math.cos(THREE.MathUtils.degToRad(75));

function labelPriority(it, activePinId, meta) {
  if (it.pin.id === activePinId) return 100;
  if (meta.ends.has(it.pin.id)) return 80;
  if (meta.notes.has(it.pin.id)) return 60;
  return 40;
}

function LabelProjector({ items, labelEls, focusing, maxLabels, activePinId, meta, clusterRef }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  const camDir = useMemo(() => new THREE.Vector3(), []);
  const nrm = useMemo(() => new THREE.Vector3(), []);
  const st = useRef({ last: 0, mat: new THREE.Matrix4(), dirty: true, state: [], placed: new Set(), heads: new Map() });
  const order = useMemo(() => {
    const ts = (it) => { const d = Date.parse(it.pin.start_date || ""); return Number.isFinite(d) ? d : Infinity; };
    return items
      .map((it, i) => ({ i, p: labelPriority(it, activePinId, meta), t: ts(it) }))
      .sort((a, b) => b.p - a.p || a.t - b.t)
      .map((o) => o.i);
  }, [items, activePinId, meta]);
  useEffect(() => { st.current.dirty = true; }, [order, size.width, size.height, focusing, maxLabels]);

  useFrame(() => {
    const s = st.current;
    const now = performance.now();
    camera.updateMatrixWorld();
    const moved = !s.mat.equals(camera.matrixWorld) || !s.projKey || s.projKey !== camera.projectionMatrix.elements.join(",");
    if ((moved || s.dirty) && now - s.last >= LABEL_RECOMPUTE_MS) {
      s.last = now;
      s.dirty = false;
      s.mat.copy(camera.matrixWorld);
      s.projKey = camera.projectionMatrix.elements.join(",");
      const close = camera.position.length() < LABEL_DIST;
      // Project visible candidates.
      const scr = [];
      for (const i of order) {
        const it = items[i];
        if (!it || it.dimmed || !(close || focusing)) continue;
        nrm.copy(it.pos).normalize();
        camDir.copy(camera.position).sub(it.pos).normalize();
        if (camDir.dot(nrm) < FACING_MIN) continue;
        v.copy(it.pos).project(camera);
        if (v.z > 1) continue;
        scr.push({ i, x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height });
      }
      // Cluster in priority order with a grid of screen buckets (cell = 28 px).
      const grid = new Map();
      const clusters = [];
      for (const c of scr) {
        const gx = Math.floor(c.x / CLUSTER_PX), gy = Math.floor(c.y / CLUSTER_PX);
        let host = null;
        for (let dx = -1; dx <= 1 && !host; dx++) for (let dy = -1; dy <= 1 && !host; dy++) {
          for (const h of grid.get(`${gx + dx},${gy + dy}`) || []) {
            if (Math.hypot(h.x - c.x, h.y - c.y) <= CLUSTER_PX) { host = h; break; }
          }
        }
        if (host) { host.members.push(c.i); continue; }
        const h = { ...c, members: [c.i] };
        clusters.push(h);
        const k = `${gx},${gy}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(h);
      }
      // Place by priority, skipping overlaps, capped per device.
      const boxes = [];
      const placed = new Set();
      const heads = new Map();
      for (const c of clusters) {
        if (placed.size >= maxLabels) break;
        const el = labelEls.current[c.i];
        if (!el) continue;
        const w = (el.offsetWidth || 80) + LABEL_PAD * 2, h = (el.offsetHeight || 28) + LABEL_PAD * 2;
        const box = { l: c.x - w / 2, r: c.x + w / 2, t: c.y - 10 - h + LABEL_PAD, b: c.y - 10 + LABEL_PAD };
        if (boxes.some((o) => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t)) continue;
        // Hysteresis: a hidden label must stay hidden 200 ms before returning.
        const prev = s.state[c.i];
        if (prev && !prev.shown && now - prev.hiddenAt < LABEL_RETURN_MS) continue;
        boxes.push(box);
        placed.add(c.i);
        heads.set(c.i, c.members);
      }
      for (let i = 0; i < items.length; i++) {
        const prev = s.state[i] || { shown: false, hiddenAt: -Infinity };
        const show = placed.has(i);
        if (prev.shown && !show) prev.hiddenAt = now;
        prev.shown = show;
        s.state[i] = prev;
        const el = labelEls.current[i];
        if (!el) continue;
        const members = heads.get(i);
        const cluster = !!members && members.length > 1;
        const place = el.firstChild;
        const want = cluster ? `${items[i].text} +${members.length - 1}` : items[i].text;
        if (place && place.textContent !== want) place.textContent = want;
        el.classList.toggle("is-cluster", cluster);
        el.style.pointerEvents = cluster ? "auto" : "none";
        el.style.opacity = show ? "1" : "0";
        el.style.visibility = show ? "visible" : "hidden";
      }
      s.heads = heads;
      clusterRef.current = heads;
    }
    // Keep shown labels glued to their pins every frame.
    for (const i of s.heads.keys()) {
      const el = labelEls.current[i];
      if (!el) continue;
      v.copy(items[i].pos).project(camera);
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * size.width}px, ${(-v.y * 0.5 + 0.5) * size.height}px) translate(-50%, calc(-100% - 10px))`;
    }
  });
  return null;
}

// Lightweight backdrop mode (login): slow, dim, non interactive spin. Still under reduced motion.
function BackdropSpin({ children, reducedMotion }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (!ref.current || reducedMotion) return;
    ref.current.rotation.y += THREE.MathUtils.degToRad(3) * Math.min(delta, 0.1);
  });
  return <group ref={ref} rotation={[0.35, -1.2, 0]}>{children}</group>;
}

// Reports once, after the first frame has been drawn and presented (next rAF).
function FirstFrame({ onFirstFrame }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    requestAnimationFrame(() => onFirstFrame?.());
  });
  return null;
}

const isTyping = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

// Drives a frameloop="demand" Canvas at a capped rate with manual invalidate.
// Stops scheduling entirely while the tab is hidden or any input has focus.
function BackdropDriver({ fps = 30, reducedMotion }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (reducedMotion) { invalidate(); return undefined; }
    const step = 1000 / fps;
    let raf = 0;
    let last = 0;
    const paused = () => document.hidden || isTyping();
    const tick = (now) => {
      raf = 0;
      if (paused()) return;
      if (now - last >= step - 2) { last = now; invalidate(); }
      raf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf && !paused()) raf = requestAnimationFrame(tick); };
    const kickLater = () => setTimeout(kick, 0); // activeElement updates after focusout
    document.addEventListener("visibilitychange", kick);
    document.addEventListener("focusin", kick);
    document.addEventListener("focusout", kickLater);
    kick();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", kick);
      document.removeEventListener("focusin", kick);
      document.removeEventListener("focusout", kickLater);
    };
  }, [fps, reducedMotion, invalidate]);
  return null;
}

const fmtCoord = (lat, lon) =>
  `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;

export default function GlobeScene({
  geoJson,
  pins = [],
  activePinId = null,
  focusJourneyId = null,
  flyTo = null,
  onPinClick,
  onMapClick,
  onHoverRegion,
  backdrop = false,
  panelOpen = false,
  panelWidth = 350,
  onFirstFrame,
  onFallback,
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [tier, setTier] = useState(() => pickTier());
  const t = tiers[tier];
  const controlsRef = useRef(null);
  const labelEls = useRef([]);
  const lastRegionRef = useRef(null);
  const hoverRafRef = useRef(null);
  const tripView = useRef(false);
  const moveRef = useRef(null);
  const viewRef = useRef(null);
  const [hoveredPinId, setHoveredPinId] = useState(null);

  const geo = useMemo(() => rewindGeo(geoJson), [geoJson]);
  const focusing = focusJourneyId != null && !String(focusJourneyId).startsWith("__");

  const items = useMemo(
    () =>
      pins
        .filter((p) => Number.isFinite(Number(p.longitude)) && Number.isFinite(Number(p.latitude)))
        .map((p) => {
          const lon = Number(p.longitude), lat = Number(p.latitude);
          return {
            pin: p,
            lon,
            lat,
            pos: lonLatToVec3(lon, lat, GLOBE_R * 1.002),
            dimmed: focusing && p.journey_id !== focusJourneyId,
            text: (p.location_name || "").split(",")[0].trim() || p.title || "",
            coord: fmtCoord(lat, lon),
          };
        }),
    [pins, focusing, focusJourneyId]
  );

  // Label priority inputs: first and last stops (journey_route_stops order) and stops
  // with notes (journal_blocks rows on the place). Read only.
  const [labelMeta, setLabelMeta] = useState({ ends: new Set(), notes: new Set() });
  useEffect(() => {
    if (!focusing) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data: stops } = await supabase
          .from("journey_route_stops")
          .select("pin_id, stop_index")
          .eq("journey_id", focusJourneyId)
          .order("stop_index", { ascending: true });
        const ids = (stops || []).map((r) => r.pin_id).filter(Boolean);
        const ends = new Set(ids.length ? [ids[0], ids[ids.length - 1]] : []);
        let notes = new Set();
        if (ids.length) {
          const { data: blocks } = await supabase
            .from("journal_blocks")
            .select("parent_id")
            .eq("parent_type", "place")
            .in("parent_id", ids);
          notes = new Set((blocks || []).map((b) => b.parent_id));
        }
        if (!cancelled) setLabelMeta({ ends, notes });
      } catch {
        // Priority falls back to the default tier; labels still render.
      }
    })();
    return () => { cancelled = true; };
  }, [focusing, focusJourneyId]);

  // Cluster tap: ease the camera in over the cluster until its pins separate.
  const clusterRef = useRef(new Map());
  const onClusterTap = useCallback((i) => {
    const members = clusterRef.current.get(i);
    const cam = controlsRef.current?.object;
    if (!members || members.length < 2 || !cam) return;
    const pts = members.map((m) => items[m]).filter(Boolean);
    const c = new THREE.Vector3();
    for (const p of pts) c.add(p.pos);
    c.normalize();
    let spread = 0;
    for (const p of pts) for (const q of pts) spread = Math.max(spread, p.pos.distanceTo(q.pos));
    const alt = cam.position.length() - GLOBE_R;
    // Screen separation scales roughly with 1 / altitude; aim for about 2x the merge radius.
    const h = Math.max(window.innerHeight || 800, 1);
    const pxPerUnit = h / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * Math.max(alt, 1e-3));
    const curPx = spread * pxPerUnit;
    const factor = curPx > 1 ? THREE.MathUtils.clamp(curPx / (CLUSTER_PX * 2), 0.15, 0.85) : 0.4;
    const nextAlt = Math.max(TRIP_MIN_DIST - GLOBE_R, alt * factor);
    moveRef.current = { kind: "open", n: c, fit: GLOBE_R + nextAlt };
  }, [items]);

  // Opening a trip eases into mock C's tilted close view. Closing eases back out.
  const focusKeyRef = useRef(null);
  useEffect(() => {
    const key = focusing ? String(focusJourneyId) : null;
    if (key === focusKeyRef.current) return;
    const stops = items.filter((it) => !it.dimmed);
    if (key != null && stops.length === 0) return; // wait for pins
    const prev = focusKeyRef.current;
    focusKeyRef.current = key;
    if (key != null) {
      const fr = tripFraming(stops);
      moveRef.current = { kind: "open", n: fr.n, fit: fitForView(fr.fit, viewRef.current) };
    } else if (prev != null) {
      const cam = controlsRef.current?.object.position;
      const n = cam ? cam.clone().normalize() : new THREE.Vector3(0, 0, 1);
      moveRef.current = { kind: "close", n, fit: HOME_DIST };
    }
  }, [focusing, focusJourneyId, items]);

  useEffect(() => {
    if (!flyTo) return;
    const lon = Number(flyTo.lon), lat = Number(flyTo.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    moveRef.current = { kind: "open", n: lonLatToVec3(lon, lat).normalize(), fit: 1.12 };
  }, [flyTo]);

  const countryAt = useCallback(
    (ll) => (ll && geo ? geo.features.find((f) => geoContains(f, [ll.lon, ll.lat])) || null : null),
    [geo]
  );

  const handleGlobeClick = useCallback(
    (point) => {
      const ll = vec3ToLonLat(point);
      const feature = countryAt(ll);
      onMapClick?.({ ...ll, isLand: !!feature, country: feature?.properties?.name });
    },
    [countryAt, onMapClick]
  );

  const handleGlobeHover = useCallback(
    (point) => {
      if (!point) {
        if (lastRegionRef.current) { lastRegionRef.current = null; onHoverRegion?.(null); }
        return;
      }
      if (hoverRafRef.current) return;
      const p = point.clone();
      hoverRafRef.current = requestAnimationFrame(() => {
        hoverRafRef.current = null;
        const name = countryAt(vec3ToLonLat(p))?.properties?.name || null;
        if (name !== lastRegionRef.current) { lastRegionRef.current = name; onHoverRegion?.(name); }
      });
    },
    [countryAt, onHoverRegion]
  );
  useEffect(() => () => hoverRafRef.current && cancelAnimationFrame(hoverRafRef.current), []);

  const dropTier = useCallback(() => setTier((cur) => (cur === "desktop" ? "phoneHigh" : "phoneLow")), []);

  // Lowest tier: no WebGL, software rendering, or sustained fps under ~20 shows a static image.
  const [renderTier] = useState(() => detectRenderTier());
  const [lowFps, setLowFps] = useState(false);
  const onLowFps = useCallback(() => { setLowFps(true); onFallback?.(); }, [onFallback]);
  useEffect(() => { if (backdrop && renderTier === "static") onFallback?.(); }, [backdrop, renderTier, onFallback]);
  // Backdrop: the parent owns the static image and its crossfade, so render nothing here.
  if (renderTier === "static" || lowFps) {
    if (backdrop) return null;
    const w = typeof window !== "undefined" ? window.innerWidth : 0;
    return <StaticGlobe offsetX={panelOffsetFor(panelOpen, w, panelWidth)} />;
  }

  if (backdrop) {
    // Login backdrop: smallest tier, no bloom, demand frameloop driven at ~30fps by
    // BackdropDriver, paused while an input has focus or the tab is hidden.
    return (
      <div className="v2-map" aria-hidden="true">
        <Canvas
          dpr={[1, 1.25]}
          frameloop="demand"
          gl={{ antialias: false, powerPreference: "low-power", toneMapping: THREE.ACESFilmicToneMapping }}
          camera={{ fov: 35, near: 0.01, far: 100, position: [0, 0, 3.0] }}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          events={() => ({ enabled: false, priority: 0 })}
        >
          <color attach="background" args={[C.bg]} />
          <BackdropDriver fps={30} reducedMotion={reducedMotion} />
          <FirstFrame onFirstFrame={onFirstFrame} />
          <FpsGuard minFps={20} onLow={onLowFps} />
          <BackdropSpin reducedMotion={reducedMotion}>
            {geo && <Globe geo={geo} tier="phoneLow" tripView={tripView} onGlobeClick={() => {}} onGlobeHover={() => {}} />}
          </BackdropSpin>
        </Canvas>
      </div>
    );
  }

  return (
    <div className="v2-map">
      <Canvas
        dpr={[t.dpr[0], t.dpr[1]]}
        gl={{ antialias: t.msaa, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        camera={{ fov: CAM.keyframes[0].fov, near: 0.005, far: 100, position: [0, 0.9, HOME_DIST - 0.12] }}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        <PerformanceMonitor onDecline={dropTier} />
        <FpsGuard minFps={20} onLow={onLowFps} />
        <color attach="background" args={[C.bg]} />
        {geo && <Globe geo={geo} tier={tier} tripView={tripView} onGlobeClick={handleGlobeClick} onGlobeHover={handleGlobeHover} />}
        <Stops
          items={items}
          activePinId={activePinId}
          hoveredPinId={hoveredPinId}
          reducedMotion={reducedMotion}
          onSelect={(pin) => onPinClick?.(pin)}
          onHover={(pin) => { setHoveredPinId(pin?.id || null); onHoverRegion?.(pin?.location_name || null); }}
        />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false}
          enableDamping={!reducedMotion}
          dampingFactor={0.08}
          rotateSpeed={0.5}
          zoomSpeed={0.7}
          minDistance={MIN_DIST}
          maxDistance={MAX_DIST}
          onStart={() => { moveRef.current = null; }}
        />
        <ViewOffset panelOpen={panelOpen} panelWidth={panelWidth} reducedMotion={reducedMotion} viewRef={viewRef} />
        <CameraDirector controlsRef={controlsRef} moveRef={moveRef} reducedMotion={reducedMotion} tripView={tripView} />
        <LabelProjector items={items} labelEls={labelEls} focusing={focusing} maxLabels={t.labels} activePinId={activePinId} meta={labelMeta} clusterRef={clusterRef} />
        {t.bloom && (
          <EffectComposer multisampling={0} resolutionScale={tier === "phoneHigh" ? 0.5 : 1}>
            <Bloom
              mipmapBlur
              intensity={t.bloom.intensity}
              radius={t.bloom.radius}
              luminanceThreshold={t.bloom.threshold}
              luminanceSmoothing={t.bloom.smoothing}
            />
          </EffectComposer>
        )}
      </Canvas>

      <div className="v2-map-overlay">
        {items.map((it, i) => (
          <div
            key={it.pin.id}
            ref={(el) => { labelEls.current[i] = el; }}
            className={`v2-pin-label${it.pin.id === activePinId ? " is-active" : ""}${reducedMotion ? " no-motion" : ""}`}
            style={{ opacity: 0, visibility: "hidden" }}
            onClick={() => onClusterTap(i)}
          >
            <span className="v2-pin-label-place">{it.text}</span>
            <span className="v2-pin-label-coord">{it.coord}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
