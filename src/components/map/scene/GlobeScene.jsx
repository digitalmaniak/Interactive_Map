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
import { poseFor, localFrame, raySphere, solveTripFit } from "./tripFit";
import StaticGlobe from "./StaticGlobe";

// v2 main view (DESIGN.md v2: mock A globe, mock C trip framing).
// One perspective camera orbiting a sphere. Draw calls stay tiny for phones:
// globe, atmosphere, coastline, marker dots, beams (5) plus bloom passes when the tier allows.

const C = tokens.color;
const CAM = tokens.camera;
const HOME_DIST = CAM.keyframes[0].distR;
const MIN_DIST = 1.08;
// Trip view lets the camera down to about 8 km: altitude 0.00125 R, distance 1.00125 R.
const TRIP_MIN_ALT = 0.00125;
// Below about 50 km the baked relief texture fades out so its softness reads as intentional.
const RELIEF_FADE_ALT = 0.0078;
const TRIP_MIN_DIST = GLOBE_R + TRIP_MIN_ALT;
const MAX_DIST = 6;
const LABEL_DIST = 1.9;
const DRAG_PX = 5;
const easeMove = bezier([0.65, 0, 0.35, 1]);
const TRIP_KEY = CAM.keyframes[CAM.keyframes.length - 1];
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

// Trip centre: mean of the pins as unit 3D vectors, normalized (never a lat/lng average),
// so trips crossing the 180 line centre on the right side of the globe.
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

function Globe({ geo, tier, onGlobeClick, onGlobeHover, tripBlend }) {
  const { gl, size, camera } = useThree();
  const t = tiers[tier];
  const { material, atmo, coast, tex } = useMemo(() => {
    const max = gl.capabilities.maxTextureSize || 4096;
    const tx = buildLandTexture(geo, Math.min(t.maskW, max));
    return { tex: tx, material: createGlobeMaterial(tx), atmo: createAtmosphereMaterial(), coast: buildCoastGeometry(geo) };
  }, [geo, gl, t.maskW]);
  useEffect(() => () => { material.dispose(); atmo.dispose(); coast.dispose(); tex.dispose(); }, [material, atmo, coast, tex]);
  useFrame(() => {
    material.uniforms.uDpr.value = gl.getPixelRatio();
    // Trip only uniforms follow tripBlend (0 globe, 1 trip), driven by the camera tween.
    const b = tripBlend ? tripBlend.current : 0;
    const alt = camera.position.length() - GLOBE_R;
    material.uniforms.uReliefMix.value = THREE.MathUtils.smoothstep(alt, RELIEF_FADE_ALT * 0.25, RELIEF_FADE_ALT);
    material.uniforms.uHatchSpacing.value = THREE.MathUtils.lerp(tokens.hatch.spacingPx.globe, tokens.hatch.spacingPx.trip, b);
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
function Stops({ items, activePinId, hoveredPinId, onSelect, onHover, reducedMotion, beamHeightRef }) {
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
    const px = THREE.MathUtils.clamp(dist * 0.0055, 0.000006, 0.02); // ~6 px disc
    if (growStart.current == null) growStart.current = performance.now();
    const g = reducedMotion ? 1 : easeGrow(Math.min(1, (performance.now() - growStart.current) / tokens.beam.growMs));
    const tripish = THREE.MathUtils.clamp((2.4 - camera.position.length()) / 1.2, 0, 1);
    beamMat.uniforms.uGrow.value = g;
    beamMat.uniforms.uHeight.value = THREE.MathUtils.lerp(tokens.beam.heightR.globe, tokens.beam.heightR.trip, tripish) * (dist < 0.5 ? dist / 0.5 + 0.15 : 1);
    if (beamHeightRef) beamHeightRef.current = beamMat.uniforms.uHeight.value * g;
    beamMat.uniforms.uWidth.value = 0.0012 * THREE.MathUtils.clamp(dist / 0.3, 0.004, 1); // thin beams near the surface
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

// Journals panel offset: shift the projection centre (not the canvas) so the globe
// or the framed trip sits centred in the space left of the panel. No offset when the
// panel would cover most of the screen (narrow / mobile).
export const panelOffsetFor = (open, width, panelWidth) =>
  open && width > panelWidth * 1.6 ? panelWidth / 2 : 0;

// One camera controller (DESIGN.md, Camera motion spec v1). Live state:
// n (unit look target), D (camera distance from the centre, in R), tilt, heading,
// fov and panel offset. Every view change runs one tween from the live state to the
// goal. Mid-move goals restart from the live pose and blend over 120 ms. A user drag
// or zoom cancels instantly. Reduced motion: 180 ms crossfade, no flight.
const BLEND_MS = 120;
const FADE_MS = 180;
const LIFT_CAP = HOME_DIST;
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const lerp = THREE.MathUtils.lerp;

function readLive(camera, controls, lastHeading) {
  const t = controls && controls.target.lengthSq() > 1e-6 ? controls.target.clone() : null;
  const D = camera.position.length();
  if (!t) return { n: camera.position.clone().normalize(), D, tilt: 0, heading: lastHeading, fov: camera.fov };
  const n = t.normalize();
  const u = camera.position.clone().addScaledVector(n, -GLOBE_R).normalize();
  const c = THREE.MathUtils.clamp(u.dot(n), -1, 1);
  const tilt = Math.acos(c);
  let heading = lastHeading;
  if (tilt > 1e-3) {
    const { north, east } = localFrame(n);
    heading = Math.atan2(-u.dot(east), -u.dot(north));
  }
  return { n, D, tilt, heading, fov: camera.fov };
}

function sampleTween(tw, now) {
  const raw = THREE.MathUtils.clamp((now - tw.t0) / tw.ms, 0, 1);
  const e = easeMove(raw);
  const a = tw.from, b = tw.to;
  const n = new THREE.Vector3().copy(a.n);
  if (tw.d > 1e-6) {
    const q = new THREE.Quaternion().slerp(tw.q, e);
    n.applyQuaternion(q);
  }
  let D = lerp(a.D, b.D, e) + tw.bump * Math.sin(Math.PI * raw);
  let tilt;
  if (tw.bump > 0) tilt = raw < 0.5 ? lerp(a.tilt, 0, easeMove(raw * 2)) : lerp(0, b.tilt, easeMove(raw * 2 - 1));
  else tilt = lerp(a.tilt, b.tilt, e);
  if (tw.zoomOnly) D = Math.min(D, a.D);
  return {
    n, D, tilt,
    heading: a.heading + tw.dh * e,
    fov: lerp(a.fov, b.fov, e),
    offset: lerp(a.offset, b.offset, e),
    raw,
  };
}

function makeTween(from, goal, now, reducedMotion) {
  const to = {
    n: goal.n.clone().normalize(),
    D: goal.D ?? from.D,
    tilt: goal.tilt ?? from.tilt,
    heading: goal.heading ?? from.heading,
    fov: goal.fov ?? from.fov,
    offset: goal.offset,
  };
  if (goal.zoomOnly) to.D = Math.min(to.D, from.D);
  const d = from.n.angleTo(to.n);
  const hPeak = Math.min(LIFT_CAP, Math.max(from.D, to.D, from.D + 1.2 * d));
  const bump = reducedMotion || d < 0.05 || goal.zoomOnly ? 0 : Math.max(0, hPeak - Math.max(from.D, to.D));
  const ms = THREE.MathUtils.clamp(700 + 900 * Math.sqrt(d / Math.PI) + 250 * Math.abs(Math.log2(to.D / from.D)), 600, 2200);
  return {
    from, to, d, bump, ms, t0: now,
    q: new THREE.Quaternion().setFromUnitVectors(from.n, to.n),
    dh: wrapPi(to.heading - from.heading),
    zoomOnly: !!goal.zoomOnly,
    goal,
  };
}

function blendStates(a, b, w) {
  const n = a.n.clone().lerp(b.n, w).normalize();
  return {
    n, D: lerp(a.D, b.D, w), tilt: lerp(a.tilt, b.tilt, w),
    heading: a.heading + wrapPi(b.heading - a.heading) * w,
    fov: lerp(a.fov, b.fov, w), offset: lerp(a.offset, b.offset, w), raw: b.raw,
  };
}

function CameraController({ controlsRef, moveRef, reducedMotion, tripView, tripBlend, labelMix, panelOpen, panelWidth, viewRef }) {
  const { camera, size, gl } = useThree();
  const st = useRef({ tw: null, prev: null, seen: null, offset: 0, offsetKey: null, heading: 0, panelTarget: null, applied: null, fade: null });
  const idleUntil = useRef(0);

  const applyOffset = (off) => {
    const s = st.current;
    s.offset = off;
    const key = `${off.toFixed(2)}|${size.width}|${size.height}`;
    if (key === s.applied) return;
    s.applied = key;
    if (off > 0.01) camera.setViewOffset(size.width, size.height, off, 0, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };

  const applyState = (x, controls) => {
    const look = x.n.clone().multiplyScalar(GLOBE_R);
    poseFor(x.n, x.D, x.tilt, x.heading, camera.position);
    if (Math.abs(camera.fov - x.fov) > 1e-4) { camera.fov = x.fov; camera.updateProjectionMatrix(); }
    applyOffset(x.offset);
    st.current.heading = x.heading;
    if (controls) { controls.target.copy(look); controls.update(); }
    else camera.lookAt(look);
  };

  useFrame((_, delta) => {
    const s = st.current;
    const controls = controlsRef.current;
    const now = performance.now();
    const alt = camera.position.length() - GLOBE_R;
    if (controls) {
      controls.rotateSpeed = THREE.MathUtils.clamp(alt * 0.35, 0.03, 0.5);
      // OrbitControls clamps the camera to target distance. In trip view the target sits on
      // the surface, so the limit is the minimum altitude, not the centre distance.
      const surfaceTarget = controls.target.lengthSq() > 0.25;
      controls.minDistance = surfaceTarget ? (tripView.current ? TRIP_MIN_ALT : MIN_DIST - GLOBE_R) : MIN_DIST;
      // Wheel and pinch get faster near the surface so the last stretch is not sluggish.
      controls.zoomSpeed = THREE.MathUtils.clamp(0.7 + (0.4 - alt) * 4, 0.7, 2.2);
      // Trip view zooms toward the cursor or pinch centre (handled below), not the target.
      controls.enableZoom = !tripView.current;
    }
    // Near plane follows altitude (about 0.1 x altitude) so near ground lines keep depth precision.
    const near = THREE.MathUtils.clamp(alt * 0.1, 0.0001, 0.05);
    if (Math.abs(near - camera.near) > camera.near * 0.05) { camera.near = near; camera.updateProjectionMatrix(); }

    const panelTarget = panelOffsetFor(panelOpen, size.width, panelWidth);
    viewRef.current = { width: size.width, height: size.height, offset: panelTarget };

    // New goal, or a panel change while idle or mid-move: one tween from the live state.
    const req = moveRef.current;
    const panelChanged = s.panelTarget !== null && panelTarget !== s.panelTarget;
    const first = s.panelTarget === null;
    s.panelTarget = panelTarget;
    if (first) applyOffset(panelTarget);
    if (req !== s.seen || panelChanged) {
      const fresh = req !== s.seen;
      s.seen = req;
      if (!req && fresh) {
        // User drag or zoom: cancel instantly; the live pose is the drag's start.
        s.tw = null; s.prev = null;
        // Settle the blend on the nearer end so a cancelled move never leaves a half state.
        setBlend(tripBlend.current >= 0.5 ? 1 : 0);
        labelMix.current = { active: false, p: 1 };
        if (s.fade) { gl.domElement.style.opacity = "1"; s.fade = null; }
      } else {
        const live = s.tw ? sampleTween(s.tw, now) : { ...readLive(camera, controls, s.heading), offset: s.offset };
        const goal = req && (fresh || s.tw) ? (fresh ? req : s.tw.goal) : { n: live.n, D: live.D, tilt: live.tilt, heading: live.heading, fov: live.fov };
        const g = { ...goal, offset: panelTarget };
        if (s.tw && !reducedMotion) s.prev = { tw: s.tw, t: now };
        if (reducedMotion) {
          s.fade = { t0: now, goal: g };
          s.tw = null;
        } else {
          s.tw = makeTween(live, g, now, false);
        }
        // Trip blend continues from its current value toward the goal's trip state.
        s.blendFrom = tripBlend.current;
        s.blendTo = g.trip !== undefined ? (g.trip ? 1 : 0) : (s.tw ? s.blendTo ?? tripBlend.current : tripBlend.current);
        labelMix.current = { active: s.blendFrom !== s.blendTo, p: 0 };
      }
    }

    if (s.fade) {
      // Reduced motion: fade out, cut to the final state, fade back in (180 ms total).
      const k = (now - s.fade.t0) / FADE_MS;
      if (k >= 0.5 && !s.fade.cut) {
        const f = s.fade.goal;
        const live = readLive(camera, controls, s.heading);
        applyState({
          n: f.n.clone().normalize(), D: f.zoomOnly ? Math.min(f.D ?? live.D, live.D) : (f.D ?? live.D),
          tilt: f.tilt ?? live.tilt, heading: f.heading ?? live.heading, fov: f.fov ?? live.fov, offset: f.offset,
        }, controls);
        s.fade.cut = true;
        setBlend(s.blendTo ?? tripBlend.current);
        labelMix.current = { active: false, p: 1 };
      }
      gl.domElement.style.opacity = String(Math.min(1, Math.abs(1 - 2 * Math.min(k, 1))));
      if (k >= 1) { gl.domElement.style.opacity = "1"; s.fade = null; finish(s, controls); }
      return;
    }

    if (!s.tw) {
      // Idle drift on the globe view, paused while the user interacts.
      if (controls && !tripView.current && !reducedMotion && now > idleUntil.current) {
        const yaw = THREE.MathUtils.degToRad(CAM.idleYawDegPerSec) * delta;
        camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        controls.update();
      }
      return;
    }

    let x = sampleTween(s.tw, now);
    if (s.prev) {
      const w = (now - s.prev.t) / BLEND_MS;
      if (w >= 1) s.prev = null;
      else x = blendStates(sampleTween(s.prev.tw, now), x, easeMove(w));
    }
    applyState(x, controls);
    // Trip blend ramps over 60 to 100 percent of the move (eased).
    const w = easeMove(THREE.MathUtils.clamp((x.raw - 0.6) / 0.4, 0, 1));
    if (s.blendTo !== undefined) setBlend(lerp(s.blendFrom, s.blendTo, w));
    if (labelMix.current.active) labelMix.current = { active: w < 1, p: w };
    if (x.raw >= 1 && !s.prev) { s.tw = null; finish(s, controls); }
  });

  function setBlend(b) {
    tripBlend.current = b;
    tripView.current = b >= 0.5;
  }

  // Globe view (tilt 0) orbits the globe centre again once the move lands.
  function finish(s, controls) {
    if (controls && camera.position.clone().normalize().angleTo(controls.target.clone().normalize()) < 1e-3 && !tripView.current) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }

  // Zoom toward a screen point in trip view: scale the camera and look target about the
  // ground point under the cursor, so that point stays put and stops never drift behind
  // the panel. Wheel uses the cursor, pinch uses the midpoint of the two touches.
  useEffect(() => {
    const el = gl.domElement;
    const rc = new THREE.Raycaster();
    const zoomAt = (clientX, clientY, scale) => {
      const controls = controlsRef.current;
      if (!controls || !tripView.current) return false;
      const rect = el.getBoundingClientRect();
      rc.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera);
      const P = raySphere(rc.ray);
      if (!P) return false;
      const alt = camera.position.length() - GLOBE_R;
      const camToP = camera.position.distanceTo(P);
      let sc = scale;
      // Keep altitude within [TRIP_MIN_ALT, MAX_DIST - R] (altitude scales about P).
      if (alt * sc < TRIP_MIN_ALT) sc = TRIP_MIN_ALT / Math.max(alt, 1e-6);
      if (camToP * sc > MAX_DIST - GLOBE_R) sc = (MAX_DIST - GLOBE_R) / camToP;
      if (Math.abs(sc - 1) < 1e-5) return true;
      moveRef.current = null; // user zoom cancels any tween
      camera.position.sub(P).multiplyScalar(sc).add(P);
      const t = controls.target.clone().sub(P).multiplyScalar(sc).add(P);
      controls.target.copy(t.normalize().multiplyScalar(GLOBE_R));
      controls.update();
      return true;
    };
    const onWheel = (e) => {
      if (!tripView.current) return;
      const speed = controlsRef.current ? controlsRef.current.zoomSpeed : 1;
      if (zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0012 * speed))) {
        e.preventDefault();
        idleUntil.current = performance.now() + CAM.idleResumeMs;
      }
    };
    const touches = new Map();
    let pinch = null;
    const onDown = (e) => { if (e.pointerType === "touch") touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); };
    const onUp = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; };
    const onMove = (e) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size !== 2 || !tripView.current) return;
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch && d > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, Math.pow(pinch / d, 1.2));
      pinch = d;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [gl, camera, controlsRef, moveRef, tripView]);

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

function LabelProjector({ items, labelEls, focusing, maxLabels, activePinId, meta, clusterRef, labelMix, beamHeightRef }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  const camDir = useMemo(() => new THREE.Vector3(), []);
  const nrm = useMemo(() => new THREE.Vector3(), []);
  const st = useRef({ last: 0, mat: new THREE.Matrix4(), dirty: true, state: [], placed: new Set(), heads: new Map(), flip: new Map() });
  const order = useMemo(() => {
    const ts = (it) => { const d = Date.parse(it.pin.start_date || ""); return Number.isFinite(d) ? d : Infinity; };
    return items
      .map((it, i) => ({ i, p: labelPriority(it, activePinId, meta), t: ts(it) }))
      .sort((a, b) => b.p - a.p || a.t - b.t)
      .map((o) => o.i);
  }, [items, activePinId, meta]);
  useEffect(() => { st.current.dirty = true; }, [order, size.width, size.height, focusing, maxLabels]);
  // Entering or leaving a trip: freeze the labels shown now (by pin id) and crossfade them
  // against the new set over the trip blend window instead of swapping at move start.
  useEffect(() => {
    const s = st.current;
    const old = new Set();
    for (const [i] of s.heads) if (s.items && s.items[i]) old.add(s.items[i].pin.id);
    s.items = items;
    if (!old.size) return;
    s.old = old;
    s.xStart = performance.now();
    s.dirty = true;
  }, [items, focusing]);

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
        let box = { l: c.x - w / 2, r: c.x + w / 2, t: c.y - 10 - h + LABEL_PAD, b: c.y - 10 + LABEL_PAD };
        // Flip below the pin when the beam's projected top leans across the label (before
        // the collision test, so placement uses the flipped box).
        const top = items[c.i].pos.clone().multiplyScalar(1 + (beamHeightRef?.current || 0)).project(camera);
        const tx = (top.x * 0.5 + 0.5) * size.width, ty = (-top.y * 0.5 + 0.5) * size.height;
        let crosses = false;
        for (let k = 1; k <= 8 && !crosses; k++) {
          const px = c.x + (tx - c.x) * (k / 8), py = c.y + (ty - c.y) * (k / 8);
          crosses = px > box.l + LABEL_PAD && px < box.r - LABEL_PAD && py > box.t + LABEL_PAD && py < box.b - LABEL_PAD;
        }
        if (crosses) box = { l: box.l, r: box.r, t: c.y + 10 - LABEL_PAD, b: c.y + 10 + h - LABEL_PAD };
        s.flip.set(c.i, crosses);
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
        if (!s.old) {
          el.style.opacity = show ? "1" : "0";
          el.style.visibility = show ? "visible" : "hidden";
        }
      }
      s.heads = heads;
      clusterRef.current = heads;
    }
    // Crossfade pass: old labels fade out as new ones fade in, on the trip blend progress.
    let oldIdx = [];
    if (s.old) {
      const mix = labelMix.current;
      let w;
      if (mix.active) w = mix.p;
      else if (now - s.xStart < 120) w = 0; // the camera move has not picked up the goal yet
      else w = 1;
      items.forEach((it, i) => {
        const el = labelEls.current[i];
        if (!el) return;
        const wasOld = s.old.has(it.pin.id) ? 1 : 0;
        const isNew = s.heads.has(i) ? 1 : 0;
        const op = w >= 1 ? isNew : Math.min(1, wasOld * (1 - w) + isNew * w);
        el.style.opacity = String(op);
        el.style.visibility = op > 0.001 ? "visible" : "hidden";
        if (wasOld && !isNew && op > 0.001) oldIdx.push(i);
      });
      if (w >= 1) { s.old = null; oldIdx = []; }
    }
    // Keep shown labels glued to their pins every frame.
    for (const i of [...s.heads.keys(), ...oldIdx]) {
      const el = labelEls.current[i];
      if (!el) continue;
      v.copy(items[i].pos).project(camera);
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * size.width}px, ${(-v.y * 0.5 + 0.5) * size.height}px) ${s.flip.get(i) ? "translate(-50%, 10px)" : "translate(-50%, calc(-100% - 10px))"}`;
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
  focusIsCollection = false,
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
  const tripBlend = useRef(0);
  const beamHeightRef = useRef(0);
  const labelMix = useRef({ active: false, p: 1 });
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
            pos: lonLatToVec3(lon, lat, GLOBE_R * 1.00005),
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
    const alt = cam.position.distanceTo(controlsRef.current.target.lengthSq() > 1e-6 ? controlsRef.current.target : c.clone().multiplyScalar(GLOBE_R));
    // Screen separation scales roughly with 1 / altitude; aim for about 2x the merge radius.
    const h = Math.max(window.innerHeight || 800, 1);
    const pxPerUnit = h / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * Math.max(alt, 1e-3));
    const curPx = spread * pxPerUnit;
    const factor = curPx > 1 ? THREE.MathUtils.clamp(curPx / (CLUSTER_PX * 2), 0.15, 0.85) : 0.4;
    moveRef.current = { n: c, D: Math.max(TRIP_MIN_DIST, GLOBE_R + (cam.position.length() - GLOBE_R) * factor), zoomOnly: true };
  }, [items]);

  // Opening a trip eases into mock C's tilted close view. Closing eases back out.
  // Trip engagement. `engaged` remembers what the camera framed: a trip (its journey key)
  // or a single point (a pin from the Imported bucket, or a pin with no trip). Exit is
  // driven only by this ref and the current props, so a click during the opening move
  // is never lost and no stale flag survives the exit.
  const engagedRef = useRef(null);
  const focusKeyRef = useRef(null);

  // Shared exit: stay over the selection, level the tilt, FOV 35, pull back to 3.2 R.
  // Never a saved pre-trip pose or the default view.
  const exitTripView = useCallback(() => {
    const eng = engagedRef.current;
    engagedRef.current = null;
    if (!eng) return;
    let n = null;
    if (eng.kind === "trip") {
      const tripPins = items.filter((it) => String(it.pin.journey_id) === eng.key);
      if (tripPins.length) n = tripFraming(tripPins).n;
    } else if (eng.n) n = eng.n.clone();
    if (!n) {
      const c = controlsRef.current;
      const tgt = c && c.target.lengthSq() > 1e-6 ? c.target : c?.object.position;
      n = tgt ? tgt.clone().normalize() : new THREE.Vector3(0, 0, 1);
    }
    moveRef.current = { n, D: HOME_DIST, tilt: 0, fov: CAM.keyframes[0].fov, trip: false };
  }, [items]);

  // Opening a trip: frame its pins (skipped for the Imported collection, which opens as
  // a single point via flyTo).
  useEffect(() => {
    const key = focusing && !focusIsCollection ? String(focusJourneyId) : null;
    if (key === focusKeyRef.current) return;
    const stops = items.filter((it) => !it.dimmed);
    if (key != null && stops.length === 0) return; // wait for pins
    focusKeyRef.current = key;
    if (key == null) return;
    // Frame the pins' ground points so their projected bbox is centred in the visible
    // area left of the panel with 80 px padding, at the trip tilt (iterative solve).
    const fr = tripFraming(stops);
    const view = viewRef.current;
    let n = fr.n, D = fr.fit;
    if (view && view.width && view.height) {
      const sol = solveTripFit(stops.map((it) => it.pos.clone().normalize()), {
        W: view.width, H: view.height, offset: panelOffsetFor(panelOpen, view.width, panelWidth),
        fov: TRIP_KEY.fov, tilt: THREE.MathUtils.degToRad(TRIP_KEY.tiltDeg), heading: 0, pad: 80, minAlt: TRIP_MIN_ALT,
      });
      n = sol.n; D = sol.D;
    }
    engagedRef.current = { kind: "trip", key };
    moveRef.current = { n, D, tilt: THREE.MathUtils.degToRad(TRIP_KEY.tiltDeg), heading: 0, fov: TRIP_KEY.fov, trip: true };
  }, [focusing, focusIsCollection, focusJourneyId, items, panelOpen, panelWidth]);

  useEffect(() => {
    if (!flyTo) return;
    const lon = Number(flyTo.lon), lat = Number(flyTo.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    const n = lonLatToVec3(lon, lat).normalize();
    // A pin inside a real trip keeps the trip as the exit anchor; otherwise it is a point.
    const eng = engagedRef.current;
    if (!(eng && eng.kind === "trip" && eng.key === focusKeyRef.current)) engagedRef.current = { kind: "point", n };
    moveRef.current = { n, D: 1.12, tilt: THREE.MathUtils.degToRad(TRIP_KEY.tiltDeg), fov: TRIP_KEY.fov, trip: true };
  }, [flyTo]);

  // Exit when the selection is gone: a trip whose focus cleared, or a point whose panel
  // closed. Map button, empty click and panel close all land here.
  useEffect(() => {
    const eng = engagedRef.current;
    if (!eng) return;
    const tripKey = focusing && !focusIsCollection ? String(focusJourneyId) : null;
    const gone = eng.kind === "trip" ? tripKey !== eng.key : !panelOpen;
    if (gone) {
      if (tripKey == null) focusKeyRef.current = null;
      exitTripView();
    }
  }, [focusing, focusIsCollection, focusJourneyId, panelOpen, activePinId, exitTripView]);

  // Canvas level empty clicks (space, beams, anything that is not a pin): exit when the
  // pointer moved under 5 px between down and up.
  const downRef = useRef(null);
  const onCanvasPointerDown = useCallback((e) => { downRef.current = { x: e.clientX, y: e.clientY }; }, []);
  const onPointerMissed = useCallback((e) => {
    const d = downRef.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) >= DRAG_PX) return;
    onMapClick?.({ offGlobe: true });
  }, [onMapClick]);

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
  // Hidden ?force3d=1 flag: always run the live scene (skips the software WebGL and
  // low fps fallbacks). Read on the client only, same as the render tier probe.
  const [force3d] = useState(() => {
    if (typeof window === "undefined") return false;
    const on = new URLSearchParams(window.location.search).get("force3d") === "1";
    if (on) console.info("[globe] force3d is on: static globe fallback disabled");
    return on;
  });
  const [lowFps, setLowFps] = useState(false);
  const onLowFps = useCallback((fps) => {
    if (force3d) return;
    console.warn(`[globe] sustained low frame rate (${Number(fps).toFixed(1)} fps), switching to the static globe`);
    setLowFps(true);
    onFallback?.();
  }, [onFallback, force3d]);
  // Lost WebGL context: log it and show a quiet notice instead of a frozen canvas.
  const [contextLost, setContextLost] = useState(false);
  const onCreated = useCallback(({ gl }) => {
    const el = gl.domElement;
    el.addEventListener("webglcontextlost", (e) => {
      e.preventDefault(); // allow the browser to restore it
      console.warn("[globe] WebGL context lost");
      setContextLost(true);
    });
    el.addEventListener("webglcontextrestored", () => {
      console.info("[globe] WebGL context restored");
      setContextLost(false);
    });
  }, []);
  useEffect(() => { if (backdrop && renderTier === "static" && !force3d) onFallback?.(); }, [backdrop, renderTier, onFallback, force3d]);
  // Backdrop: the parent owns the static image and its crossfade, so render nothing here.
  if (!force3d && (renderTier === "static" || lowFps)) {
    if (typeof window !== "undefined" && !window.__globeStaticLogged) {
      window.__globeStaticLogged = true;
      console.info(`[globe] static globe shown (${lowFps ? "low frame rate" : "no hardware WebGL"}); pins and camera moves need the live scene`);
    }
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
            {geo && <Globe geo={geo} tier="phoneLow" tripBlend={null} onGlobeClick={() => {}} onGlobeHover={() => {}} />}
          </BackdropSpin>
        </Canvas>
      </div>
    );
  }

  return (
    <div className="v2-map" onPointerDownCapture={onCanvasPointerDown}>
      <Canvas
        onPointerMissed={onPointerMissed}
        onCreated={onCreated}
        dpr={[t.dpr[0], t.dpr[1]]}
        gl={{ antialias: t.msaa, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        camera={{ fov: CAM.keyframes[0].fov, near: 0.005, far: 100, position: [0, 0.9, HOME_DIST - 0.12] }}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        <PerformanceMonitor onDecline={dropTier} />
        <FpsGuard minFps={20} onLow={onLowFps} />
        <color attach="background" args={[C.bg]} />
        {geo && <Globe geo={geo} tier={tier} tripBlend={tripBlend} onGlobeClick={handleGlobeClick} onGlobeHover={handleGlobeHover} />}
        <Stops
          beamHeightRef={beamHeightRef}
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
        <CameraController controlsRef={controlsRef} moveRef={moveRef} reducedMotion={reducedMotion} tripView={tripView} tripBlend={tripBlend} labelMix={labelMix} panelOpen={panelOpen} panelWidth={panelWidth} viewRef={viewRef} />
        <LabelProjector items={items} labelEls={labelEls} focusing={focusing} maxLabels={t.labels} activePinId={activePinId} meta={labelMeta} clusterRef={clusterRef} labelMix={labelMix} beamHeightRef={beamHeightRef} />
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

      {contextLost && (
        <div className="v2-globe-notice" role="status">Globe paused. Graphics were interrupted, reload the page to restore it.</div>
      )}
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
