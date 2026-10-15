"use client";
/* eslint-disable react-hooks/immutability -- three.js objects (camera, controls, uniforms) are mutated imperatively inside useFrame by design */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { makeTapGuard } from "./tapGuard";
import { easeInOutCubic, FLYOVER } from "./flyover/flyoverTiming";
import { buildFlyoverPlan } from "./flyover/flyoverPlan";
const DRAFT_FLY_MS = 3000; // draft preview flyover, about 3 s in total
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { geoArea, geoContains } from "d3-geo";
import { countryNames, shortLegRegion } from "../../../lib/legs/shortLegRegion";
import { countryName } from "../../../lib/geo/countryName";
import { dragThrough, wasDragged } from "./dragThrough";
import { GLOBE_R, rewindGeo, lonLatToVec3, vec3ToLonLat, buildLandTexture, buildCoastGeometry } from "./geometry";
import { createGlobeMaterial, createAtmosphereMaterial, createBeamMaterial, LAND_RELIEF } from "./GlobeMaterial";
import { tokens, tiers, bezier } from "./tokens";
import { detectRenderTier } from "./renderTier";
import { supabase } from "../../../lib/supabase/client";
import FpsGuard from "./FpsGuard";
import { EdgeTagsDriver, EdgeTagsLayer, useEdgeTagsStore } from "./EdgeTags";
import { fmtMonthYear } from "../../../lib/dates/calendar";
import { Line2, LineGeometry, LineMaterial } from "three-stdlib";
import { PULSE, ringPhase, ringOpacity, easeOut } from "../../../lib/rings/homePulse";
const PIN_PX_K = 0.0055; // stop disc world size per unit camera distance (about 6 px)
import LegsLayer from "./legs/LegsLayer";
import { resolveLegs } from "./legs/legGeometry";
import { sharedJourneyLegs } from "../../../lib/journeys/legs";
import { tripZoomK } from "./legs/legGeometry";
import useFlyover from "./flyover/useFlyover";
import { TRIP_TITLE, titleReservePx, titleBottomPx, HOME_RINGS, pickHomeBase } from "./mockA";
import { fetchHomeBases } from "../../../lib/homeBases";
import { tripCounts } from "../../../lib/legs/tripHeader";
import { poseFor, localFrame, raySphere, solveTripFit, estimateLabelBox } from "./tripFit";

// Trip framing margins: 80 px plus the overlay chrome measured from the DOM (tab bar and
// wordmark on top, profile on the bottom left), with a little extra room on the left.
const TRIP_PAD = 80;
function tripPads(W, H) {
  let top = 0, bottom = 0;
  if (typeof document !== "undefined") {
    for (const el of document.querySelectorAll(".ui-layer .top-left-group, .ui-layer .v2-nav")) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.top < H / 3) top = Math.max(top, r.bottom);
    }
    for (const el of document.querySelectorAll(".ui-layer .bottom-left-group")) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.bottom > (2 * H) / 3) bottom = Math.max(bottom, H - r.top);
    }
  }
  // The timeline strip (when shown) lifts the title block and the framing by its height.
  const strip = typeof document !== "undefined" && W >= STRIP.hideBelowPx && document.querySelector(".v2-timeline") ? STRIP.heightPx : 0;
  // The trip title block sits bottom left in trip view; pins must stay above it.
  bottom = titleReservePx(H, bottom) + strip;
  return { top: TRIP_PAD + top, right: TRIP_PAD, bottom: TRIP_PAD + bottom, left: TRIP_PAD + 24 };
}
import StaticGlobe from "./StaticGlobe";
import TimelineStrip from "../../timeline/TimelineStrip";
import { STRIP } from "../../timeline/timelineLogic";

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
const BORDER_LIFT_MAX = 0.0003;
const TRIP_MIN_DIST = GLOBE_R + TRIP_MIN_ALT;
// A trip with one located stop (a typed draft before the rest are found) frames a region,
// about 500 km up, so land and borders stay on screen instead of an 8 km close up.
const SINGLE_STOP_ALT = 0.08;
const MAX_DIST = 6;
const LABEL_DIST = 1.9;
const DRAG_PX = 5;
const PIN_HOVER_PX = 16; // screen radius that counts as hovering a pin
const easeMove = bezier([0.65, 0, 0.35, 1]);
const TRIP_KEY = CAM.keyframes[CAM.keyframes.length - 1];
// Trip view pull back limit, measured from the surface target: about a whole hemisphere.
const TRIP_MAX_D = 2.2;
// Prism pan/orbit values.
const AUTO_ROTATE_MIN_ALT = 1.5 * 1; // height above the surface, in R
const AUTO_ROTATE_RESUME_MS = 4000;
const ORBIT_DAMP = 0.12;
const DAMP_TAU = -1 / (60 * Math.log(1 - ORBIT_DAMP)); // 0.12 per frame at 60 fps
const TRIP_POLAR_MIN = THREE.MathUtils.degToRad(20);
const TRIP_POLAR_MAX = THREE.MathUtils.degToRad(70);
const TRIP_AZ_RANGE = THREE.MathUtils.degToRad(60);
const TRIP_FLY_MS = 2400;
const AUTO_ROTATE_EASE_S = 1.5;
const HOME_FREE_PX = 6; // pointer travel that ends the post-dismiss free spin
// Zoom-to-cursor incidence fade (cosine between the view ray and the surface normal).
const ZOOM_GRAZE_MIN = 0.3, ZOOM_GRAZE_FULL = 0.6;
const ZOOM_GESTURE_MS = 800;

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

// Exact ray/sphere hit in world space, then into the globe's own (local) frame, so lat/lng
// stay right if the globe group is ever rotated or tilted.
function localHit(e) {
  const obj = e.eventObject || e.object;
  if (obj) obj.updateWorldMatrix(true, false);
  const inv = obj ? obj.matrixWorld.clone().invert() : null;
  const ray = inv ? e.ray.clone().applyMatrix4(inv) : e.ray;
  const p = raySphere(ray);
  if (p) return p;
  return obj ? obj.worldToLocal(e.point.clone()) : e.point;
}

// Region readout probe: every frame the cursor or the camera moved (drag inertia, flies,
// zoom), re-cast the live cursor through the live camera and look up the country there.
// Mesh pointer events only fire when the mouse moves, so a still cursor over a moving globe
// used to keep a stale country. Pins and short-leg dots report their own country.
function RegionProbe({ pointerRef, draggingRef, pinHoverRef, dotHoverRef, onPoint }) {
  const { camera, gl } = useThree();
  const st = useMemo(() => ({ rc: new THREE.Raycaster(), v: new THREE.Vector2(), key: "", t: 0 }), []);
  useFrame(() => {
    const ptr = pointerRef.current;
    if (!ptr || draggingRef.current || pinHoverRef.current || dotHoverRef.current) { st.key = ""; return; }
    const e = camera.matrixWorld.elements;
    const key = `${ptr.x},${ptr.y},${e[12].toFixed(5)},${e[13].toFixed(5)},${e[14].toFixed(5)},${e[0].toFixed(4)},${e[5].toFixed(4)}`;
    const now = performance.now();
    if (key === st.key || now - st.t < 40) return;
    st.key = key; st.t = now;
    const rect = gl.domElement.getBoundingClientRect();
    st.v.set(((ptr.x - rect.left) / rect.width) * 2 - 1, -((ptr.y - rect.top) / rect.height) * 2 + 1);
    st.rc.setFromCamera(st.v, camera);
    onPoint(raySphere(st.rc.ray));
  });
  return null;
}

function Globe({ geo, tier, onGlobeClick, onGlobeHover, tripBlend, cheap = false }) {
  const { gl, size, camera } = useThree();
  const coastRef = useRef();
  const t = cheap ? { ...tiers.phoneLow, globeSeg: [64, 32], maskW: 1024 } : tiers[tier];
  const { material, atmo, coast, tex } = useMemo(() => {
    const max = gl.capabilities.maxTextureSize || 4096;
    const tx = buildLandTexture(geo, Math.min(t.maskW, max));
    return { tex: tx, material: createGlobeMaterial(tx, { cheap }), atmo: createAtmosphereMaterial(), coast: buildCoastGeometry(geo) };
  }, [geo, gl, t.maskW, cheap]);
  useEffect(() => () => { material.dispose(); atmo.dispose(); coast.dispose(); tex.dispose(); }, [material, atmo, coast, tex]);
  useFrame(() => {
    material.uniforms.uDpr.value = gl.getPixelRatio();
    // Trip only uniforms follow tripBlend (0 globe, 1 trip), driven by the camera tween.
    const b = tripBlend ? tripBlend.current : 0;
    const alt = camera.position.length() - GLOBE_R;
    // Border lift grows with altitude (smooth in log altitude): 0 at the 8 km minimum,
    // BORDER_LIFT_MAX at full globe view. Applied as a scale, no geometry rebuild.
    if (coastRef.current) {
      const k = THREE.MathUtils.smoothstep(Math.log(Math.max(alt, 1e-6)), Math.log(TRIP_MIN_ALT), Math.log(HOME_DIST - GLOBE_R));
      coastRef.current.scale.setScalar(1 + BORDER_LIFT_MAX * k);
    }
    material.uniforms.uReliefMix.value = !LAND_RELIEF ? 0 : THREE.MathUtils.smoothstep(alt, RELIEF_FADE_ALT * 0.25, RELIEF_FADE_ALT);
    material.uniforms.uHatchSpacing.value = THREE.MathUtils.lerp(tokens.hatch.spacingPx.globe, tokens.hatch.spacingPx.trip, b);
  });
  void size;
  return (
    <group>
      <mesh
        material={material}
        onClick={(e) => {
          if (e.delta > DRAG_PX) return;
          // A click that also hit a pin belongs to the pin, never to add-point.
          if (e.intersections?.some((h) => h.object?.userData?.pinHit)) return;
          onGlobeClick(localHit(e));
        }}
        onPointerOut={() => onGlobeHover?.(null)}
      >
        <sphereGeometry args={[GLOBE_R, t.globeSeg[0], t.globeSeg[1]]} />
      </mesh>
      {!cheap && (
        <mesh material={atmo} scale={1.015} raycast={() => null}>
          <sphereGeometry args={[GLOBE_R, 64, 32]} />
        </mesh>
      )}
      <lineSegments ref={coastRef} geometry={coast} raycast={() => null}>
        <lineBasicMaterial color={C.coast} transparent opacity={C.coastOpacity} />
      </lineSegments>
    </group>
  );
}

// Home rings (Prism): three 1px cyan rings around the dated home base at 1x, 1.8x and 2.6x
// the pin size, in pin scale (screen space, not km), opacity 0.6 / 0.35 / 0.15 outward.
// Pulse (the original, homePulse.js): each ring grows from home out to the 2.6x size over
// 3.6 s, eased out, starting 1.2 s apart, rising to 0.6 then fading to 0. Reduced motion:
// the three rings sit still at 1x / 1.8x / 2.6x with 0.6 / 0.35 / 0.15.
function HomeRings({ home, still }) {
  const { size, camera } = useThree();
  const frame = useMemo(() => {
    if (!home) return null;
    const n = lonLatToVec3(home.lng, home.lat, 1).normalize();
    const { north, east } = localFrame(n);
    const q = new THREE.Quaternion().setFromRotationMatrix((() => { const m = new THREE.Matrix4().makeBasis(north, east, n); return m.determinant() < 0 ? m.makeBasis(east, north, n) : m; })());
    return { n, q };
  }, [home]);
  const rings = useMemo(() => {
    if (!frame) return [];
    const pos = [];
    for (let k = 0; k <= HOME_RINGS.segments; k++) {
      const a = (k / HOME_RINGS.segments) * Math.PI * 2;
      pos.push(Math.cos(a), Math.sin(a), 0);
    }
    return Array.from({ length: PULSE.count }, (_, i) => {
      const g = new LineGeometry(); g.setPositions(pos);
      const m = new LineMaterial({ color: HOME_RINGS.color, linewidth: 1, worldUnits: false, transparent: true, opacity: HOME_RINGS.opacity[i], depthWrite: false });
      const l = new Line2(g, m); l.computeLineDistances(); l.frustumCulled = false;
      return l;
    });
  }, [frame]);
  useEffect(() => () => rings.forEach((r) => { r.geometry.dispose(); r.material.dispose(); }), [rings]);
  useEffect(() => { rings.forEach((r) => r.material.resolution.set(size.width, size.height)); }, [rings, size]);
  useEffect(() => { if (typeof window !== "undefined") window.__homeRings = rings; }, [rings]); // smoke tests read these
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (!frame || !rings.length) return;
    // Pin size in world units at the home point: the stop disc formula (about 6 px).
    const base = frame.n.clone().multiplyScalar(GLOBE_R * HOME_RINGS.lift);
    const dist = tmp.copy(camera.position).distanceTo(base);
    const pin = THREE.MathUtils.clamp(dist * PIN_PX_K, 0.000006, 0.02);
    const now = performance.now(), maxS = HOME_RINGS.scale[HOME_RINGS.scale.length - 1];
    rings.forEach((r, i) => {
      r.position.copy(base);
      r.quaternion.copy(frame.q);
      if (still) { r.scale.setScalar(pin * HOME_RINGS.scale[i]); r.material.opacity = HOME_RINGS.opacity[i]; r.visible = true; return; }
      const ph = ringPhase(now, i);
      r.scale.setScalar(Math.max(1e-6, pin * maxS * easeOut(ph)));
      r.material.opacity = ringOpacity(ph);
      r.visible = r.material.opacity > 0.001;
    });
  });
  if (!rings.length) return null;
  return <group>{rings.map((r, i) => <primitive key={i} object={r} raycast={() => null} />)}</group>;
}

// Stop dots (one InstancedMesh) and stop beams (one InstancedMesh).
// Route colours are pushed above 1 (emissive 1.6, accent 2.0) so only they cross the bloom threshold.
function Stops({ items, activePinId, hoveredPinId, onSelect, onHover, reducedMotion, beamHeightRef, hideBeams = false, tripBlend }) {
  const dots = useRef();
  const beams = useRef();
  const hits = useRef();
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
    const d = dots.current, b = beams.current, hm = hits.current;
    if (!d || !b) return;
    const dist = camera.position.length() - GLOBE_R;
    const px = THREE.MathUtils.clamp(dist * PIN_PX_K, 0.000006, 0.02); // ~6 px disc
    if (growStart.current == null) growStart.current = performance.now();
    const g = reducedMotion ? 1 : easeGrow(Math.min(1, (performance.now() - growStart.current) / tokens.beam.growMs));
    const tripish = THREE.MathUtils.clamp((2.4 - camera.position.length()) / 1.2, 0, 1);
    beamMat.uniforms.uGrow.value = g;
    const h0 = THREE.MathUtils.lerp(tokens.beam.heightR.globe, tokens.beam.heightR.trip, tripish) * (dist < 0.5 ? dist / 0.5 + 0.15 : 1);
    // Trip view: beam length = min(current length, 0.15 x altitude), blended in with tripBlend
    // so globe view keeps today's beams. uHeight is a per frame uniform, no rebuild.
    const tb = tripBlend ? tripBlend.current : 0;
    beamMat.uniforms.uHeight.value = THREE.MathUtils.lerp(h0, Math.min(h0, 0.15 * dist), tb);
    // Lite (force3d): no beams at all; dots, hit spheres and labels stay.
    b.visible = !hideBeams;
    if (beamHeightRef) beamHeightRef.current = hideBeams ? 0 : beamMat.uniforms.uHeight.value * g;
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
      if (hm) {
        // Invisible hit sphere about 3x the dot so pins win over the globe click.
        tmp.scale.setScalar(px * 3);
        tmp.updateMatrix();
        hm.setMatrixAt(i, tmp.matrix);
        tmp.scale.set(s, s, s);
        tmp.updateMatrix();
      }
      b.setMatrixAt(i, tmp.matrix);
      col.set(active ? C.accent : C.route).multiplyScalar(active ? tokens.glow.emissive.accent : tokens.glow.emissive.route);
      if (it.dimmed) col.set(C.route).multiplyScalar(0.25);
      d.setColorAt(i, col);
      aColor.setXYZ(i, col.r, col.g, col.b);
      aAlpha.setX(i, it.dimmed ? 0 : 1);
    });
    d.instanceMatrix.needsUpdate = true;
    if (hm) { hm.instanceMatrix.needsUpdate = true; hm.computeBoundingSphere?.(); }
    if (d.instanceColor) d.instanceColor.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true;
    aColor.needsUpdate = true;
    aAlpha.needsUpdate = true;
  });

  if (!items.length) return null;
  return (
    <group>
      <instancedMesh key={`b-${items.length}`} ref={beams} args={[beamGeo, beamMat, items.length]} raycast={() => null} frustumCulled={false} />
      <instancedMesh key={`d-${items.length}`} ref={dots} args={[undefined, undefined, items.length]} frustumCulled={false} raycast={() => null}>
        <circleGeometry args={[1, 20]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        key={`h-${items.length}`}
        ref={hits}
        args={[undefined, undefined, items.length]}
        frustumCulled={false}
        userData={{ pinHit: true }}
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta > DRAG_PX) return;
          const it = items[e.instanceId];
          if (it && !it.dimmed) onSelect(it.pin);
        }}
        onPointerOver={(e) => { e.stopPropagation(); const it = items[e.instanceId]; if (it && !it.dimmed) onHover(it.pin); }}
        onPointerOut={() => onHover(null)}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </instancedMesh>
    </group>
  );
}

// Journals panel offset: shift the projection centre (not the canvas) so the globe
// or the framed trip sits centred in the space left of the panel. No offset when the
// panel would cover most of the screen (narrow / mobile).
const SHEET_EASE_MS = 300;
const RELEASE_MS = 600; // zoom back out to world view after an interrupted exit
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
  const e = (tw.ease || easeMove)(raw);
  const a = tw.from, b = tw.to;
  const n = new THREE.Vector3().copy(a.n);
  if (tw.d > 1e-6) {
    const q = new THREE.Quaternion().slerp(tw.q, e);
    n.applyQuaternion(q);
  }
  let D = lerp(a.D, b.D, e) + tw.bump * Math.sin(Math.PI * raw);
  let tilt;
  const tp = tw.tiltPeak ?? 0;
  if (tw.bump > 0) tilt = raw < 0.5 ? lerp(a.tilt, tp, easeMove(raw * 2)) : lerp(tp, b.tilt, easeMove(raw * 2 - 1));
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
  // Cinematic share flyover: an explicit peak distance (or none) per move.
  const bump = reducedMotion || goal.noBump || goal.zoomOnly ? 0
    : goal.peakD != null ? Math.max(0, goal.peakD - Math.max(from.D, to.D))
    : d < 0.05 ? 0 : Math.max(0, hPeak - Math.max(from.D, to.D));
  const ms = goal.ms ?? THREE.MathUtils.clamp(700 + 900 * Math.sqrt(d / Math.PI) + 250 * Math.abs(Math.log2(to.D / from.D)), 600, 2200);
  return {
    from, to, d, bump, ms, t0: now,
    q: new THREE.Quaternion().setFromUnitVectors(from.n, to.n),
    dh: wrapPi(to.heading - from.heading),
    zoomOnly: !!goal.zoomOnly,
    ease: goal.ease || null,
    tiltPeak: goal.tiltPeak ?? null,
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

function CameraController({ homeResumeRef, pinHoverRef, pointerRef, itemsRef, draggingRef, onDragStart, onDragEndAt, controlsRef, moveRef, reducedMotion, tripView, tripBlend, labelMix, panelOpen, panelWidth, viewRef, sheetInset = 0, tripMaxD = TRIP_MAX_D }) {
  const { camera, size, gl } = useThree();
  const st = useRef({ tw: null, prev: null, seen: null, offset: 0, offsetKey: null, heading: 0, panelTarget: null, applied: null, fade: null, voff: 0, vFrom: 0, vTo: null, vT0: 0 });
  const idleUntil = useRef(0);

  const applyOffset = (off) => {
    const s = st.current;
    s.offset = off;
    const key = `${off.toFixed(2)}|${s.voff.toFixed(2)}|${size.width}|${size.height}`;
    if (key === s.applied) return;
    s.applied = key;
    // Vertical part: the mobile bottom sheet (visible area y in [0, H - 2 * voff]).
    if (off > 0.01 || s.voff > 0.01) camera.setViewOffset(size.width, size.height, off, s.voff, size.width, size.height);
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

  // Trip view orbit: heading (azimuth) within +-60 deg of the fly-in heading, tilt (polar
  // angle from the local vertical) within 20..70 deg. Distance and target stay put.
  const orbitBy = (dHeading, dTilt, controls) => {
    const s = st.current;
    if (!controls || controls.target.lengthSq() < 0.25) return;
    const live = readLive(camera, controls, s.heading);
    const base = s.flyHeading ?? live.heading;
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const rel = THREE.MathUtils.clamp(wrap(live.heading + dHeading - base), -TRIP_AZ_RANGE, TRIP_AZ_RANGE);
    // Zoomed out, trip tilt eases toward top-down; never snap it back up to 20 deg.
    const tilt = THREE.MathUtils.clamp(live.tilt + dTilt, Math.min(TRIP_POLAR_MIN, live.tilt), TRIP_POLAR_MAX);
    applyState({ ...live, heading: base + rel, tilt, offset: s.offset }, controls);
  };

  // Last cursor position anywhere on the page (the dismiss happens over the dialog).
  useEffect(() => {
    const onMove = (e) => { st.current.lastPtr = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerdown", onMove, true);
    return () => { window.removeEventListener("pointermove", onMove, true); window.removeEventListener("pointerdown", onMove, true); };
  }, []);

  const orbitRef = useRef(orbitBy);
  useEffect(() => { orbitRef.current = orbitBy; });

  useFrame((_, delta) => {
    const s = st.current;
    const controls = controlsRef.current;
    const now = performance.now();
    const alt = camera.position.length() - GLOBE_R;
    if (controls) {
      // Grab-to-follow: OrbitControls turns 2*PI*rotateSpeed per screen height; the ground
      // under the cursor moves about alt * fov per screen height, so scale by height above
      // the surface (not centre distance). Close up this stops pans overshooting.
      // Grab-to-follow, scaled by height above the surface: OrbitControls turns 2*PI*speed per
      // canvas height, and the ground under the view centre moves H / (2 * h * tan(fov / 2)) px
      // per radian, so speed = h * tan(fov / 2) / PI keeps the grabbed point under the cursor.
      // (Prism's h / R measured 2.8x to 10x too fast.) Clamped before applying: never <= 0.
      const fovHalf = THREE.MathUtils.degToRad(camera.fov) / 2;
      controls.rotateSpeed = THREE.MathUtils.clamp((Math.max(0, alt) * Math.tan(fovHalf)) / Math.PI, 0.001, 1.0);
      // Damping per second, not per frame: 0.12 at 60 fps (tau about 0.13 s), so inertia
      // settles in about 1 s at any frame rate.
      controls.dampingFactor = 1 - Math.exp(-Math.min(delta, 0.1) / DAMP_TAU);
      controls.enableRotate = !tripView.current;
      // OrbitControls clamps the camera to target distance. In trip view the target sits on
      // the surface, so the limit is the minimum altitude, not the centre distance.
      const surfaceTarget = controls.target.lengthSq() > 0.25;
      controls.minDistance = surfaceTarget ? (tripView.current ? TRIP_MIN_ALT : MIN_DIST - GLOBE_R) : MIN_DIST;
      // Wheel and pinch get faster near the surface so the last stretch is not sluggish.
      controls.zoomSpeed = THREE.MathUtils.clamp(0.7 + (0.4 - alt) * 4, 0.7, 2.2);
      // Trip view zooms toward the cursor or pinch centre (handled below), not the target.
      controls.enableZoom = !tripView.current;
      controls.maxDistance = surfaceTarget && tripView.current ? tripMaxD : MAX_DIST;
    }
    // Near plane follows altitude (about 0.1 x altitude) so near ground lines keep depth precision.
    const near = THREE.MathUtils.clamp(alt * 0.1, 0.0001, 0.05);
    if (Math.abs(near - camera.near) > camera.near * 0.05) { camera.near = near; camera.updateProjectionMatrix(); }

    const panelTarget = panelOffsetFor(panelOpen, size.width, panelWidth);
    // Mobile bottom sheet: the canvas stays full screen; the projection centre eases (300 ms)
    // to the middle of the area above the sheet.
    const vTarget = Math.max(0, Math.min(size.height * 0.45, sheetInset / 2));
    if (s.vTo === null) { s.vTo = vTarget; s.voff = vTarget; s.vFrom = vTarget; }
    else if (vTarget !== s.vTo) { s.vFrom = s.voff; s.vTo = vTarget; s.vT0 = now; }
    if (s.voff !== s.vTo) {
      const k = reducedMotion ? 1 : Math.min(1, (now - s.vT0) / SHEET_EASE_MS);
      s.voff = k >= 1 ? s.vTo : s.vFrom + (s.vTo - s.vFrom) * easeMove(k);
      applyOffset(s.offset);
    }
    viewRef.current = { width: size.width, height: size.height, offset: panelTarget, offsetY: s.voff, offsetYTarget: s.vTo };
    if (typeof window !== "undefined") { window.__globeCamD = camera.position.length(); window.__globeCam = camera; window.__globeTrip = tripView.current; window.__globeTarget = controls ? controls.target.toArray() : null; } // smoke tests read these

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
        const wasExit = !!s.tw && s.blendTo === 0;
        s.tw = null; s.prev = null;
        // Settle the blend on the nearer end so a cancelled move never leaves a half state.
        // An exit (goal out of trip view) always settles on the globe view, so a drag during
        // the exit never strands the camera in trip view.
        const exiting = wasExit;
        setBlend(exiting ? 0 : tripBlend.current >= 0.5 ? 1 : 0);
        if (exiting && controls && controls.target.lengthSq() > 1e-6) { controls.target.set(0, 0, 0); controls.update(); }
        // The zoom still eases out to the world view once the drag ends (see idle branch).
        if (exiting) s.pendingOut = true;
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

    if (!s.tw && s.pendingOut && !draggingRef.current) {
      // A drag interrupted the exit: finish the zoom out to world view distance over
      // RELEASE_MS with the flyover easing, from wherever the drag left the camera.
      s.pendingOut = false;
      if (camera.position.length() < HOME_DIST - 0.02) {
        moveRef.current = { n: camera.position.clone().normalize(), D: HOME_DIST, tilt: 0, heading: s.heading, fov: CAM.keyframes[0].fov, trip: false, ms: reducedMotion ? 1 : RELEASE_MS, ease: easeInOutCubic };
        return;
      }
    }
    if (!s.tw) {
      // Idle drift on the globe view, paused while the user interacts.
      // Hover pause that does not depend on pointer events: R3F only re-raycasts on
      // pointer move, so a pin drifting under a still cursor never fires pointerover.
      // Each frame, test the last pointer position against the projected pins.
      let underCursor = false;
      const ptr = pointerRef.current;
      if (ptr && ptr.inside) {
        const rect = gl.domElement.getBoundingClientRect();
        const px = ptr.x - rect.left, py = ptr.y - rect.top;
        const camDirV = new THREE.Vector3();
        const v = new THREE.Vector3();
        for (const it of itemsRef.current || []) {
          if (it.dimmed) continue;
          camDirV.copy(camera.position).sub(it.pos).normalize();
          if (camDirV.dot(it.pos) <= 0) continue; // far side
          v.copy(it.pos).project(camera);
          const sx = (v.x * 0.5 + 0.5) * size.width, sy = (-v.y * 0.5 + 0.5) * size.height;
          if (Math.hypot(sx - px, sy - py) <= PIN_HOVER_PX) { underCursor = true; break; }
        }
      }
      // Trip view drag orbit inertia (same 0.12 per frame decay as the globe damping).
      const ov = s.orbitVel;
      if (ov && tripView.current && !s.orbitDrag) {
        orbitBy(ov.h * delta * 1000, ov.t * delta * 1000, controls);
        const k = Math.exp(-Math.min(delta, 0.1) / DAMP_TAU); ov.h *= k; ov.t *= k;
        if (Math.abs(ov.h) + Math.abs(ov.t) < 1e-6) s.orbitVel = null;
      }
      // Zoom to cursor (globe view): keep the ground point grabbed at the wheel step under
      // the cursor by turning the camera about the globe centre; the target stays at the centre.
      const za = s.zoomAnchor;
      if (za && controls && !tripView.current && controls.target.lengthSq() < 1e-6) {
        if (now - za.t > 450 || draggingRef.current) s.zoomAnchor = null;
        else {
          const rect = gl.domElement.getBoundingClientRect();
          const rc = new THREE.Raycaster();
          rc.setFromCamera(new THREE.Vector2(((za.x - rect.left) / rect.width) * 2 - 1, -((za.y - rect.top) / rect.height) * 2 + 1), camera);
          const q = raySphere(rc.ray);
          // Near the limb the ray grazes the globe and holding that point would spin the view;
          // fade the correction out by incidence so the edge is a plain centre zoom.
          const w = q ? THREE.MathUtils.smoothstep(-rc.ray.direction.dot(q.clone().normalize()), ZOOM_GRAZE_MIN, ZOOM_GRAZE_FULL) : 0;
          if (q && w > 0 && q.angleTo(za.p) > 1e-7) {
            const full = new THREE.Quaternion().setFromUnitVectors(q.normalize(), za.p);
            camera.position.applyQuaternion(new THREE.Quaternion().slerp(full, w));
            controls.update();
          }
        }
      }
      // Auto-rotate: only at globe zoom (height over 1.5 R), 4 s after the last drag ended,
      // never while dragging or zoomed in.
      // Quick add dismiss: hold auto-rotate until the ease out home lands, then ramp it in.
      // homeHold counts down a few idle frames (the move may start next frame) and restarts
      // while the move is running, so rotation waits for the landing.
      // After landing it ignores the hover pause (the trip exit centres the trip's pins right
      // under a cursor resting where Cancel was) until the next real pointer move, more than
      // HOME_FREE_PX from where the cursor was at the dismiss (trackpad jitter does not
      // count), or a drag or zoom (each sets idleUntil away from 0). Then hover pauses again.
      if (homeResumeRef?.current) { homeResumeRef.current = 0; idleUntil.current = 0; s.homeHold = 3; s.homeFree = true; s.homeAnchor = s.lastPtr ? { ...s.lastPtr } : null; }
      if (s.homeHold) s.homeHold = s.tw || s.fade ? 3 : s.homeHold - 1;
      if (s.homeFree && s.lastPtr) {
        if (!s.homeAnchor) s.homeAnchor = { ...s.lastPtr };
        else if (Math.hypot(s.lastPtr.x - s.homeAnchor.x, s.lastPtr.y - s.homeAnchor.y) > HOME_FREE_PX) s.homeFree = false;
      }
      if (s.homeFree && (idleUntil.current !== 0 || draggingRef.current)) s.homeFree = false;
      const hoverPause = (pinHoverRef.current || underCursor) && !s.homeFree;
      const autoOn = controls && !tripView.current && !reducedMotion && !draggingRef.current && alt > AUTO_ROTATE_MIN_ALT && now > idleUntil.current && !hoverPause && !s.homeHold;
      if (!autoOn) s.autoK = 0;
      if (autoOn) {
        // Gentle restart: speed eases in from 0 over 1.5 s (smoothstep).
        s.autoK = Math.min(1, (s.autoK || 0) + delta / AUTO_ROTATE_EASE_S);
        const yaw = THREE.MathUtils.degToRad(CAM.idleYawDegPerSec) * delta * THREE.MathUtils.smoothstep(s.autoK, 0, 1);
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
    if (tripView.current) { s.flyHeading = s.heading; s.orbitVel = null; }
    if (controls && camera.position.clone().normalize().angleTo(controls.target.clone().normalize()) < 1e-3 && !tripView.current) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }

  // Trip view wheel and pinch ignore the cursor: dolly along the camera to target axis.
  // The target is the trip framing centre and the panel view offset is untouched, so the
  // trip stays centred left of the panel. Tilt eases toward top down as the camera pulls
  // back (full trip tilt up close, flat by the hemisphere limit).
  useEffect(() => {
    const el = gl.domElement;
    const zoomAt = (_x, _y, scale) => {
      const controls = controlsRef.current;
      if (!controls || !tripView.current) return false;
      const T = controls.target;
      if (T.lengthSq() < 0.25) return false;
      const off = camera.position.clone().sub(T);
      const d0 = off.length();
      if (d0 < 1e-9) return false;
      const d = THREE.MathUtils.clamp(d0 * scale, TRIP_MIN_ALT, tripMaxD);
      if (Math.abs(d - d0) < 1e-9) return true;
      moveRef.current = null; // user zoom cancels any tween
      const n = T.clone().normalize();
      const dir = off.divideScalar(d0);
      const cur = Math.acos(THREE.MathUtils.clamp(dir.dot(n), -1, 1));
      // Tilt: 48 deg framing tilt at trip height easing to 0 (straight down) by about 1.5R.
      const tilt = THREE.MathUtils.degToRad(TRIP_KEY.tiltDeg) * (1 - tripZoomK(d));
      if (cur > 1e-4) {
        const side = dir.clone().sub(n.clone().multiplyScalar(Math.cos(cur))).normalize();
        dir.copy(n).multiplyScalar(Math.cos(tilt)).addScaledVector(side, Math.sin(tilt));
      }
      camera.position.copy(T).addScaledVector(dir, d);
      controls.update();
      return true;
    };
    const onWheel = (e) => {
      if (!tripView.current) {
        const controls = controlsRef.current;
        if (!controls || controls.target.lengthSq() > 1e-6) return;
        const rect = el.getBoundingClientRect();
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
        const p = raySphere(rc.ray);
        const s = st.current, now = performance.now();
        // Keep the first step's point while the wheel keeps going at the same spot.
        // A wheel gesture that starts off the globe or at a grazing limb hit stays a plain
        // centre zoom until the wheel pauses (0.8 s), even once the growing globe reaches the cursor.
        const fresh = !s.zoomGesture || now - s.zoomGesture.t > ZOOM_GESTURE_MS;
        const grazing = !p || -rc.ray.direction.dot(p.clone().normalize()) < ZOOM_GRAZE_MIN;
        if (fresh) s.zoomGesture = { centre: grazing, t: now };
        s.zoomGesture.t = now;
        if (s.zoomGesture.centre || grazing) { s.zoomAnchor = null; return; }
        if (p && !(s.zoomAnchor && now - s.zoomAnchor.t < 450 && Math.hypot(s.zoomAnchor.x - e.clientX, s.zoomAnchor.y - e.clientY) < 3)) s.zoomAnchor = { p: p.normalize(), x: e.clientX, y: e.clientY, t: now };
        else if (p && s.zoomAnchor) s.zoomAnchor.t = now;
        else if (!p) s.zoomAnchor = null;
        return;
      }
      const speed = controlsRef.current ? controlsRef.current.zoomSpeed : 1;
      if (zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0012 * speed))) {
        e.preventDefault();
        idleUntil.current = performance.now() + AUTO_ROTATE_RESUME_MS;
      }
    };
    const touches = new Map();
    let pinch = null;
    // Trip view drag: left/right orbits (heading), up/down tilts. Speeds: half a turn per
    // canvas width, a quarter turn per canvas height. Release keeps the velocity (inertia).
    const s = st.current;
    const onDown = (e) => {
      if (e.pointerType === "touch") touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!tripView.current || (e.pointerType === "touch" && touches.size > 1) || e.button > 0) { s.orbitDrag = null; return; }
      moveRef.current = null; // a drag cancels any tween
      s.orbitVel = null;
      s.orbitDrag = { x: e.clientX, y: e.clientY, t: performance.now(), vh: 0, vt: 0 };
      idleUntil.current = Infinity;
    };
    const onUp = (e) => {
      touches.delete(e.pointerId); if (touches.size < 2) pinch = null;
      const d = s.orbitDrag;
      if (d) {
        s.orbitDrag = null;
        s.orbitVel = performance.now() - d.t < 80 ? { h: d.vh, t: d.vt } : null;
        idleUntil.current = performance.now() + AUTO_ROTATE_RESUME_MS;
      }
    };
    const onOrbitMove = (e) => {
      const d = s.orbitDrag;
      if (!d || !tripView.current || touches.size > 1) return;
      const rect = el.getBoundingClientRect(), now = performance.now();
      const dh = -((e.clientX - d.x) / rect.width) * Math.PI, dt = -((e.clientY - d.y) / rect.height) * (Math.PI / 2);
      const ms = Math.max(1, now - d.t);
      d.vh = dh / ms; d.vt = dt / ms; d.x = e.clientX; d.y = e.clientY; d.t = now;
      orbitRef.current(dh, dt, controlsRef.current);
    };
    const onMove = (e) => {
      onOrbitMove(e);
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
  }, [gl, camera, controlsRef, moveRef, tripView, tripMaxD]);

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    // Drag start clears the region readout and suppresses it until the drag ends.
    const pause = () => { idleUntil.current = Infinity; draggingRef.current = true; onDragStart?.(); };
    const resume = () => {
      idleUntil.current = performance.now() + AUTO_ROTATE_RESUME_MS;
      draggingRef.current = false;
      // Refill the region readout once at the last cursor position, no mouse move needed.
      const ptr = pointerRef.current;
      if (!ptr || !ptr.inside || !onDragEndAt) return;
      const rect = gl.domElement.getBoundingClientRect();
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(((ptr.x - rect.left) / rect.width) * 2 - 1, -((ptr.y - rect.top) / rect.height) * 2 + 1), camera);
      onDragEndAt(raySphere(rc.ray));
    };
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
const TRIP_LABEL_PAD = 4; // Prism: 4 px pad around each trip stop label
const TRIP_LABEL_RETURN_PX = 8; // a hidden trip label returns only once clear by 8 px
const LABEL_RECOMPUTE_MS = 100;
// A trip enter or exit crossfade never outlives this, even if the camera move that drives it
// was replaced or never ran (labels from the old trip were left on the globe).
const LABEL_XFADE_MAX_MS = 2500;
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
      // Trip view (Prism): the selected stop wins, then the label nearer the camera.
      if (focusing) {
        const act = (c) => c.members.some((m) => items[m]?.pin.id === activePinId);
        const dist = (c) => camera.position.distanceToSquared(items[c.i].pos);
        clusters.sort((a, b) => (act(b) - act(a)) || dist(a) - dist(b));
      }
      // Place by priority, skipping overlaps, capped per device.
      const boxes = [];
      const placed = new Set();
      const heads = new Map();
      for (const c of clusters) {
        if (placed.size >= maxLabels) break;
        const el = labelEls.current[c.i];
        if (!el) continue;
        // Trip view pads 4 px; a hidden label must be clear by 8 px to return (no flicker).
        const prevS = s.state[c.i];
        const pad = focusing ? TRIP_LABEL_PAD + (prevS && !prevS.shown ? TRIP_LABEL_RETURN_PX : 0) : LABEL_PAD;
        const w = (el.offsetWidth || 80) + pad * 2, h = (el.offsetHeight || 28) + pad * 2;
        let box = { l: c.x - w / 2, r: c.x + w / 2, t: c.y - 10 - h + pad, b: c.y - 10 + pad };
        // Flip below the pin when the beam's projected top leans across the label (before
        // the collision test, so placement uses the flipped box).
        const top = items[c.i].pos.clone().multiplyScalar(1 + (beamHeightRef?.current || 0)).project(camera);
        const tx = (top.x * 0.5 + 0.5) * size.width, ty = (-top.y * 0.5 + 0.5) * size.height;
        let crosses = false;
        for (let k = 1; k <= 8 && !crosses; k++) {
          const px = c.x + (tx - c.x) * (k / 8), py = c.y + (ty - c.y) * (k / 8);
          crosses = px > box.l + pad && px < box.r - pad && py > box.t + pad && py < box.b - pad;
        }
        if (crosses) box = { l: box.l, r: box.r, t: c.y + 10 - pad, b: c.y + 10 + h - pad };
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
        // Clusters are always clickable; in trip view every stop label is (it selects the stop).
        el.style.pointerEvents = cluster || focusing ? "auto" : "none";
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
      if (now - s.xStart > LABEL_XFADE_MAX_MS) w = 1;
      else if (mix.active) w = mix.p;
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
      // Done: drop the old set and recompute at once so the final styles come from the
      // current view (not heads computed mid move).
      if (w >= 1) { s.old = null; oldIdx = []; s.dirty = true; s.last = 0; }
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
  draftLegs = null,
  previewLeg = null, // Add entry: dashed 40% leg from the trip's last stop to the picked place
  legsReloadKey = 0, // bump to refetch the open trip's legs after a save // trip draft preview: leg rows (pin ids "draft:i") used instead of a fetch
  draftPlayKey = null, // changes when a parsed draft should play its fast flyover
  legsOverride = null, // share view: leg rows read by the page (share token client), no fetch here
  autoPlayKey = null, // share view: plays the normal flyover once per key
  cinematic = false, // share view: Prism's cinematic flyover (also plays with reduced motion, as cuts)
  onFlyState, // share view: called with the flyover state on every change
  flyApiRef = null, // share view: filled with { play, stop, seekLeg }
  flyTo = null,
  focusIsCollection = false,
  focusTitle = null,
  onPinClick,
  onMapClick,
  onHoverRegion,
  backdrop = false,
  panelOpen = false,
  panelWidth = 350,
  onFirstFrame,
  onFallback,
  timeline = null,
  resetKey = 0,
  homeKey = 0,
  sheetInset = 0,
}) {
  // Mobile bottom sheet height in px (0 on desktop or when closed): the camera centres
  // the globe or the trip in the area above it.
  const sheetInsetRef = useRef(sheetInset);
  useEffect(() => { sheetInsetRef.current = sheetInset; }, [sheetInset]);
  // Globe taps: drags, long presses, pinches and taps during a sheet animation never count.
  const tapGuard = useMemo(() => makeTapGuard(), []);
  useEffect(() => { tapGuard.sheetChanged(); }, [sheetInset, tapGuard]);
  useEffect(() => {
    const mv = (e) => tapGuard.move(e.pointerId, e.clientX, e.clientY);
    const up = (e) => tapGuard.up(e.pointerId, e.clientX, e.clientY);
    window.addEventListener("pointermove", mv, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => { window.removeEventListener("pointermove", mv, true); window.removeEventListener("pointerup", up, true); window.removeEventListener("pointercancel", up, true); };
  }, [tapGuard]);
  const reducedMotion = usePrefersReducedMotion();
  // Hidden ?force3d=1 flag: always run the live scene (skips the software WebGL and
  // low fps fallbacks). Read on the client only, same as the render tier probe.
  // QA only: ?force3d=1&pulse=1 keeps the home ring pulse animating in lite mode.
  const [pulseQA] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pulse") === "1");
  const [force3d] = useState(() => {
    if (typeof window === "undefined") return false;
    const on = new URLSearchParams(window.location.search).get("force3d") === "1";
    if (on) console.info("[globe] force3d is on: static globe fallback disabled");
    return on;
  });
  const [tier, setTier] = useState(() => pickTier());
  // force3d runs the cheapest live path: DPR 0.5, no bloom or postprocessing, no hatch,
  // light geometry. Normal users are unaffected.
  const t = force3d ? { ...tiers.phoneLow, dpr: [0.5, 0.5], msaa: false, bloom: null, globeSeg: [64, 32], maskW: 1024 } : tiers[tier];
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
  const pinHoverRef = useRef(false);
  const pointerRef = useRef(null);
  const draggingRef = useRef(false);

  const geo = useMemo(() => rewindGeo(geoJson), [geoJson]);
  const focusing = focusJourneyId != null && !String(focusJourneyId).startsWith("__");
  // Trip draft preview: not a saved journey, so nothing is fetched for it.
  const isDraft = focusing && String(focusJourneyId).startsWith("draft:");
  // Draft or share view: legs come in as props, and no owner query runs.
  const external = isDraft || (focusing && legsOverride != null);

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
    if (!focusing || external) return undefined;
    let cancelled = false;
    const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
    const sig = (q) => (ac && typeof q.abortSignal === "function" ? q.abortSignal(ac.signal) : q);
    (async () => {
      try {
        const { data: stops } = await sig(supabase
          .from("journey_route_stops")
          .select("pin_id, stop_index")
          .eq("journey_id", focusJourneyId)
          .order("stop_index", { ascending: true }));
        const ids = (stops || []).map((r) => r.pin_id).filter(Boolean);
        const ends = new Set(ids.length ? [ids[0], ids[ids.length - 1]] : []);
        let notes = new Set();
        if (ids.length) {
          const { data: blocks } = await sig(supabase
            .from("journal_blocks")
            .select("parent_id")
            .eq("parent_type", "place")
            .in("parent_id", ids));
          notes = new Set((blocks || []).map((b) => b.parent_id));
        }
        if (!cancelled) setLabelMeta({ ends, notes });
      } catch {
        // Priority falls back to the default tier; labels still render.
      }
    })();
    return () => { cancelled = true; ac?.abort(); };
  }, [focusing, focusJourneyId, external]);

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
  // Journey legs for the open trip only (owner RLS, same client as the Journals legs
  // review). Read only. Cleared when no real trip is open.
  const tripKeyForLegs = focusing && !focusIsCollection ? String(focusJourneyId) : null;
  const [legRows, setLegRows] = useState({ key: null, rows: [] });
  useEffect(() => {
    if (!tripKeyForLegs || external) return undefined;
    let cancelled = false;
    const req = sharedJourneyLegs(tripKeyForLegs);
    req.promise
      .then((rows) => { if (!cancelled) setLegRows({ key: tripKeyForLegs, rows: rows || [] }); })
      .catch((err) => { if (!cancelled) { console.warn("[globe] legs not loaded", err?.message || err); setLegRows({ key: tripKeyForLegs, rows: [] }); } });
    return () => { cancelled = true; req.release(); };
  }, [tripKeyForLegs, external, legsReloadKey]);
  const tripLegs = useMemo(() => {
    if (!tripKeyForLegs || (!external && legRows.key !== tripKeyForLegs)) return [];
    const byId = {};
    for (const p of pins) byId[p.id] = p;
    return resolveLegs(external ? (isDraft ? draftLegs : legsOverride) || [] : legRows.rows, byId);
  }, [tripKeyForLegs, legRows, pins, draftLegs, legsOverride, external, isDraft]);
  const previewLegs = useMemo(() => resolveLegs(previewLeg ? [previewLeg] : [], {}).map((l) => ({ ...l, preview: true, home: false })), [previewLeg]);
  const legs = useMemo(() => (previewLegs.length ? [...tripLegs, ...previewLegs] : tripLegs), [tripLegs, previewLegs]);

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

  // Go home (quick add dismissal): the shared exit if a trip or point is engaged, else the
  // same pull back to the zoomed-out globe over the current spot; auto-rotate resumes now.
  const homeResumeRef = useRef(0);
  useEffect(() => {
    if (!homeKey) return;
    const had = engagedRef.current;
    exitTripView();
    if (!had) {
      const c = controlsRef.current;
      const n = c ? c.object.position.clone().normalize() : new THREE.Vector3(0, 0, 1);
      moveRef.current = { n, D: HOME_DIST, tilt: 0, fov: CAM.keyframes[0].fov, trip: false };
    }
    homeResumeRef.current = 1;
  }, [homeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Normal trip fit goal (used when a trip opens and when a flyover ends).
  const tripFitGoal = useCallback((stops) => {
    // Frame the pins' ground points so their projected bbox is centred in the visible
    // area left of the panel with 80 px padding, at the trip tilt (iterative solve).
    const fr = tripFraming(stops);
    let view = viewRef.current;
    // The canvas may not have rendered a frame yet (pins already loaded): measure the
    // map container so the fit still uses the real viewport and panel offset.
    if ((!view || !view.width) && typeof document !== "undefined") {
      const r = document.querySelector(".v2-map")?.getBoundingClientRect();
      if (r && r.width && r.height) view = { width: r.width, height: r.height };
    }
    let n = fr.n, D = stops.length < 2 ? Math.max(fr.fit, GLOBE_R + SINGLE_STOP_ALT) : fr.fit;
    if (view && view.width && view.height) {
      const sol = solveTripFit(stops.map((it) => it.pos.clone().normalize()), {
        W: view.width, H: view.height, offset: panelOffsetFor(panelOpen, view.width, panelWidth), offsetY: Math.max(0, Math.min(view.height * 0.45, sheetInsetRef.current / 2)),
        fov: TRIP_KEY.fov, tilt: THREE.MathUtils.degToRad(TRIP_KEY.tiltDeg), heading: 0,
        pad: tripPads(view.width, view.height), labels: stops.map((it) => estimateLabelBox(it.text, it.coord)),
        minAlt: stops.length < 2 ? SINGLE_STOP_ALT : TRIP_MIN_ALT,
      });
      n = sol.n; D = sol.D;
    }
    return { n, D, tilt: THREE.MathUtils.degToRad(TRIP_KEY.tiltDeg), heading: 0, fov: TRIP_KEY.fov, trip: true, ms: TRIP_FLY_MS, ease: easeInOutCubic };
  }, [panelOpen, panelWidth]);

  // Opening a trip: frame its pins (skipped for the Imported collection, which opens as
  // a single point via flyTo).
  useEffect(() => {
    const key = focusing && !focusIsCollection ? String(focusJourneyId) : null;
    if (key === focusKeyRef.current) return;
    const stops = items.filter((it) => !it.dimmed);
    if (key != null && stops.length === 0) return; // wait for pins
    focusKeyRef.current = key;
    if (key == null) return;
    engagedRef.current = { kind: "trip", key };
    moveRef.current = tripFitGoal(stops);
  }, [focusing, focusIsCollection, focusJourneyId, items, panelOpen, panelWidth, tripFitGoal]);

  // Selection at the moment a point engages (read by the flyTo effect below, same commit).
  const selRef = useRef({ pin: null, focus: null });
  useEffect(() => { selRef.current = { pin: activePinId, focus: focusJourneyId }; });

  useEffect(() => {
    if (!flyTo) return;
    const lon = Number(flyTo.lon), lat = Number(flyTo.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    const n = lonLatToVec3(lon, lat).normalize();
    // A pin inside a real trip keeps the trip as the exit anchor; otherwise it is a point.
    const eng = engagedRef.current;
    if (!(eng && eng.kind === "trip" && eng.key === focusKeyRef.current)) engagedRef.current = { kind: "point", n, pin: selRef.current.pin, focus: selRef.current.focus };
    moveRef.current = { n, D: 1.12, tilt: THREE.MathUtils.degToRad(TRIP_KEY.tiltDeg), fov: TRIP_KEY.fov, trip: true };
  }, [flyTo]);

  // Dated home bases (owner only, read only). Trip view uses the base whose range holds
  // the trip's first date; globe view uses the current base.
  const [homeBases, setHomeBases] = useState([]);
  useEffect(() => {
    // Share view: home stays private, so no home base is ever requested there.
    if (cinematic || autoPlayKey) return undefined;
    let off = false;
    fetchHomeBases().then((b) => { if (!off) setHomeBases(b); }).catch((err) => console.warn("[globe] home bases not loaded", err?.message || err));
    return () => { off = true; };
  }, [cinematic, autoPlayKey]);
  const tripStops = useMemo(() => (focusing && !focusIsCollection ? items.filter((it) => !it.dimmed) : []), [focusing, focusIsCollection, items]);
  const tripDates = useMemo(() => {
    const ds = tripStops.flatMap((it) => [it.pin.start_date, it.pin.end_date]).filter(Boolean).map((d) => String(d).slice(0, 10)).sort();
    return ds.length ? { from: ds[0], to: ds[ds.length - 1] } : null;
  }, [tripStops]);
  const home = useMemo(() => pickHomeBase(homeBases, tripStops.length ? tripDates?.from : null), [homeBases, tripStops, tripDates]);
  const tripSub = useMemo(() => {
    if (!tripStops.length) return "";
    const fmt = (d) => (fmtMonthYear(d) || "").toUpperCase();
    const parts = [];
    if (tripDates) parts.push(tripDates.from.slice(0, 7) === tripDates.to.slice(0, 7) ? fmt(tripDates.from) : `${fmt(tripDates.from)} TO ${fmt(tripDates.to)}`);
    const c = tripCounts(tripStops.length, tripLegs);
    const counts = [c.stops, c.flights].filter(Boolean).join(" · ");
    const kmText = tripLegs.length && c.km ? c.km : "";
    return { base: parts.join("   "), counts, km: kmText };
  }, [tripStops, tripDates, tripLegs]);

  // Timeline strip: shown at 600 px and wider, left of the panel, clear of the profile chip,
  // and ending 12 px before the Add entry button (measured, so it tracks the button's size).
  const [stripBox, setStripBox] = useState({ W: 0, H: 0, chipRight: 0, addLeft: null, addTop: null });
  useEffect(() => {
    const measure = () => {
      const r = document.querySelector(".ui-layer .bottom-left-group")?.getBoundingClientRect();
      const a = document.querySelector(".ui-layer .bottom-right-group")?.getBoundingClientRect();
      const next = { W: window.innerWidth, H: window.innerHeight, chipRight: r && r.width > 0 ? r.right : 0, addLeft: a && a.width > 0 ? a.left : null, addTop: a && a.width > 0 ? a.top : null };
      setStripBox((cur) => (Object.keys(next).every((k) => cur[k] === next[k]) ? cur : next));
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    const watch = () => ["bottom-left-group", "bottom-right-group"].forEach((c) => { const el = document.querySelector(`.ui-layer .${c}`); if (el && ro) ro.observe(el); });
    watch();
    const t = setTimeout(() => { watch(); measure(); }, 500);
    return () => { window.removeEventListener("resize", measure); ro?.disconnect(); clearTimeout(t); };
  }, []);
  const stripOn = !!timeline && stripBox.W >= STRIP.hideBelowPx;
  // Edge tags (main globe only): kept clear of the panel, timeline, top-left stack and nav.
  const edgeStore = useEdgeTagsStore();
  const edgeOn = !autoPlayKey && !isDraft && !legsOverride;
  const edgeSafe = useMemo(() => ({
    top: 56, left: 0,
    right: panelOpen ? panelWidth + 16 : 0,
    bottom: sheetInset ? sheetInset : stripOn ? STRIP.insetPx + STRIP.heightPx : 0,
    block: { x0: 0, y0: 0, x1: 244, y1: 176 },
  }), [panelOpen, panelWidth, sheetInset, stripOn]);
  const edgeFly = useCallback((n) => { moveRef.current = { n, ms: reducedMotion ? 1 : undefined }; }, [reducedMotion]);
  const stripLeft = Math.max(STRIP.insetPx, stripBox.chipRight ? stripBox.chipRight + STRIP.gapPx : 0);
  const stripRight = useMemo(() => {
    // 24 px from the screen edge, or 16 px short of the open panel.
    const base = panelOpen ? panelWidth + 16 : STRIP.insetPx;
    const { W, H, addLeft, addTop } = stripBox;
    // Only when the button shares the strip's band and sits left of the strip's right end.
    if (addLeft == null || addTop == null || addTop >= H - STRIP.insetPx || addTop + 1 < H - STRIP.insetPx - STRIP.heightPx - 64) return base;
    if (addLeft - STRIP.gapPx >= W - base) return base;
    return Math.max(base, W - addLeft + STRIP.gapPx);
  }, [stripBox, panelOpen, panelWidth]);
  // Trip range for the strip: stop dates first; with no dated stop, the trip's own dates
  // (journey_stats_v2); with neither, an undated range spaced by stop order.
  const stripTrip = useMemo(() => {
    if (!tripStops.length) return null;
    const stops = tripStops.map((it) => ({ id: it.pin.id, label: it.text, start: it.pin.start_date ? String(it.pin.start_date).slice(0, 10) : null, end: it.pin.end_date ? String(it.pin.end_date).slice(0, 10) : null }));
    if (tripDates) return { from: tripDates.from, to: tripDates.to, legs, stops, mode: "dated" };
    const row = (timeline?.trips || []).find((r) => r.journey_id === focusJourneyId);
    const from = row?.first_date ? String(row.first_date).slice(0, 10) : null;
    const to = row?.last_date ? String(row.last_date).slice(0, 10) : from;
    return { from, to, legs, stops, mode: from ? "tripRange" : "undated" };
  }, [tripStops, tripDates, legs, timeline, focusJourneyId]);

  // Trip flyover: stop to stop in leg order through the same CameraController.
  const flyEnabled = focusing && !focusIsCollection && legs.length > 0;
  const flyEndGoal = useCallback(() => tripFitGoal(items.filter((it) => !it.dimmed)), [tripFitGoal, items]);
  // Draft preview: the same flyover, scaled to about DRAFT_FLY_MS in total.
  const draftTiming = useMemo(() => {
    if (!isDraft || !legs.length) return null;
    const base = buildFlyoverPlan(legs, { reducedMotion: false }).totalMs || 1;
    const k = Math.min(1, DRAFT_FLY_MS / base);
    const t = { ...FLYOVER };
    for (const key of ["shortLegMs", "longFlightMs", "holdMs", "introMs", "outroMs"]) t[key] = Math.max(120, Math.round(FLYOVER[key] * k));
    return t;
  }, [isDraft, legs]);
  const fly = useFlyover({ legs, enabled: flyEnabled, tripKey: tripKeyForLegs, reducedMotion, moveRef, fov: TRIP_KEY.fov, endGoal: flyEndGoal, timing: draftTiming, cinematic });
  // A parsed draft plays its fast flyover after the trip fit has had a moment to start.
  const playedRef = useRef(null);
  const flyPlayRef = useRef(null);
  useEffect(() => { flyPlayRef.current = fly.play; });
  useEffect(() => {
    // Keyed by the located stop set too, so fixing a stop in the preview replays it.
    const k = `${draftPlayKey}|${tripKeyForLegs}`;
    if (!isDraft || !draftPlayKey || !flyEnabled || playedRef.current === k) return undefined;
    const t = setTimeout(() => { playedRef.current = k; flyPlayRef.current?.(); }, 700);
    return () => clearTimeout(t);
  }, [isDraft, draftPlayKey, flyEnabled, tripKeyForLegs]);
  // Share view: the normal flyover plays once per autoPlayKey after the trip fit starts.
  useEffect(() => {
    const k = `${autoPlayKey}|${tripKeyForLegs}`;
    if (!autoPlayKey || !flyEnabled || (reducedMotion && !cinematic) || playedRef.current === k) return undefined;
    const t = setTimeout(() => { playedRef.current = k; flyPlayRef.current?.(); }, cinematic ? 300 : 1200);
    return () => clearTimeout(t);
  }, [autoPlayKey, flyEnabled, tripKeyForLegs, reducedMotion, cinematic]);
  useEffect(() => { onFlyState?.(fly.state); }, [fly.state, onFlyState]);
  useEffect(() => {
    if (!flyApiRef) return;
    flyApiRef.current = {
      play: fly.play,
      stop: fly.stop,
      toggle: fly.toggle,
      finish: fly.finish,
      stops: () => fly.planNow().stops || [],
      totalMs: () => fly.planNow().totalMs || 0,
      // Jump to the start of a leg and pause there (same seek as the timeline dots).
      seekLeg: (legId) => {
        const plan = fly.planNow();
        let t = 0;
        for (const st of plan.steps || []) {
          if (st.kind === "move" && st.legId === legId) { fly.seek(t + 1, 600); return true; }
          t += st.ms;
        }
        return false;
      },
    };
  });
  const flyOn = fly.state.playing || fly.state.paused;
  const shownActivePinId = flyOn ? fly.state.pinId : activePinId;
  const activeLegId = flyOn ? fly.state.legId : undefined;
  const flyToggle = fly.toggle, flyStop = fly.stop, flyPause = fly.pause;
  const flyOnRef = useRef(false);
  useEffect(() => { flyOnRef.current = flyOn; }, [flyOn]);
  useEffect(() => {
    if (!flyEnabled) return undefined;
    const onKey = (e) => {
      const t = e.target;
      if (e.code === "Space" || e.key === " ") {
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName))) return;
        e.preventDefault(); flyToggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flyEnabled, flyToggle]);
  // Esc while a flyover is active (playing or paused) ONLY stops the flyover. Capture phase
  // on window runs before any button or the journal's Esc handler, and nothing else sees it.
  // With no flyover active this listener is gone, so the journal's Esc works as before.
  useEffect(() => {
    if (!flyEnabled || !flyOn) return undefined;
    const onEsc = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      flyStop();
    };
    window.addEventListener("keydown", onEsc, true);
    return () => window.removeEventListener("keydown", onEsc, true);
  }, [flyEnabled, flyOn, flyStop]);

  // Exit when the selection is gone: a trip whose focus cleared, or a point whose panel
  // closed. Map button, empty click and panel close all land here.
  useEffect(() => {
    const eng = engagedRef.current;
    if (!eng) return;
    const tripKey = focusing && !focusIsCollection ? String(focusJourneyId) : null;
    // A point is gone when the panel closes, its pin closes (Esc or back to the list), or
    // the journal it was opened from closes. Keeps the camera from staying anchored.
    const gone = eng.kind === "trip"
      ? tripKey !== eng.key
      : !panelOpen || (eng.pin != null && activePinId !== eng.pin) || (eng.focus != null && focusJourneyId !== eng.focus);
    if (gone) {
      if (tripKey == null) focusKeyRef.current = null;
      exitTripView();
    }
  }, [focusing, focusIsCollection, focusJourneyId, panelOpen, activePinId, exitTripView]);

  // Canvas level empty clicks (space, beams, anything that is not a pin): exit when the
  // pointer moved under 5 px between down and up.
  const downRef = useRef(null);
  const onCanvasPointerDown = useCallback((e) => { downRef.current = { x: e.clientX, y: e.clientY }; tapGuard.down(e.pointerId, e.clientX, e.clientY); }, [tapGuard]);
  const onPointerMissed = useCallback((e) => {
    const d = downRef.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) >= DRAG_PX) return;
    if (!tapGuard.isTap()) return;
    // During a flyover an empty click only pauses it; it never exits the trip.
    if (flyOnRef.current) { flyPause(); return; }
    onMapClick?.({ offGlobe: true });
  }, [onMapClick, flyPause, tapGuard]);

  // Point-in-polygon lookup. Skip wrongly wound features (area over a hemisphere, e.g.
  // Bermuda in countries.json) that would otherwise "contain" most of the planet.
  const hitFeatures = useMemo(() => (geo ? geo.features.filter((f) => geoArea(f) < 2 * Math.PI) : []), [geo]);
  const countryAt = useCallback(
    (ll) => (ll ? hitFeatures.find((f) => geoContains(f, [ll.lon, ll.lat])) || null : null),
    [hitFeatures]
  );

  const handleGlobeClick = useCallback(
    (point) => {
      if (labelPressRef.current) return; // the press belonged to a label
      if (!tapGuard.isTap()) return;
      if (flyOnRef.current) { flyPause(); return; }
      const ll = vec3ToLonLat(point);
      const feature = countryAt(ll);
      onMapClick?.({ ...ll, isLand: !!feature, country: feature?.properties?.name });
    },
    [countryAt, onMapClick, flyPause, tapGuard]
  );

  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { if (typeof window !== "undefined") { window.__globeItems = items; window.__globeHoverPin = hoveredPinId; } }, [items, hoveredPinId]); // smoke tests read these
  const clearRegionReadout = useCallback(() => {
    if (hoverRafRef.current) { cancelAnimationFrame(hoverRafRef.current); hoverRafRef.current = null; }
    if (lastRegionRef.current) { lastRegionRef.current = null; }
    onHoverRegion?.(null);
  }, [onHoverRegion]);
  // Empty-globe reset from the parent (resetKey bumps): drop pin hover (bright pin, dimmed
  // others), the region tag and the stale cursor, so nothing stays half focused.
  useEffect(() => {
    if (!resetKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot reset requested by the parent
    setHoveredPinId(null);
    pinHoverRef.current = false;
    pointerRef.current = null;
    clearRegionReadout();
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const hoverPtRef = useRef(null);
  // Set when a label takes a press; cleared after the pointerup's click has run.
  const labelPressRef = useRef(false);
  useEffect(() => {
    const clear = () => setTimeout(() => { labelPressRef.current = false; }, 0);
    window.addEventListener("pointerup", clear, true);
    window.addEventListener("pointercancel", clear, true);
    return () => { window.removeEventListener("pointerup", clear, true); window.removeEventListener("pointercancel", clear, true); };
  }, []);
  const dotHoverRef = useRef(false);
  const handleRegionPoint = useCallback((point) => {
    const name = point ? countryAt(vec3ToLonLat(point))?.properties?.name || null : null;
    if (name !== lastRegionRef.current) { lastRegionRef.current = name; onHoverRegion?.(name); }
  }, [countryAt, onHoverRegion]);
  // Short-leg dot hover: the countries at the leg's own from and to points ("Costa Rica ·
  // Panama"); point-in-polygon at the dot is only the fallback.
  const names = useMemo(() => countryNames(hitFeatures), [hitFeatures]);
  const handleDotHover = useCallback((point, leg) => {
    dotHoverRef.current = !!leg;
    if (!leg || draggingRef.current) return;
    if (hoverRafRef.current) { cancelAnimationFrame(hoverRafRef.current); hoverRafRef.current = null; }
    const nameAt = (ll) => countryAt(ll)?.properties?.name || null;
    const name = shortLegRegion(leg, names, nameAt, point ? vec3ToLonLat(point) : null);
    if (name !== lastRegionRef.current) { lastRegionRef.current = name; onHoverRegion?.(name); }
  }, [countryAt, names, onHoverRegion]);
  const handleGlobeHover = useCallback(
    (point) => {
      if (!point) {
        if (lastRegionRef.current) { lastRegionRef.current = null; onHoverRegion?.(null); }
        return;
      }
      if (draggingRef.current) return; // no readout while dragging
      // Country under the cursor only: the exact ray/sphere hit (not the faceted mesh
      // hit), point-in-polygon, evaluated at the LATEST pointer position of the frame.
      hoverPtRef.current = point.clone();
      if (hoverRafRef.current) return;
      hoverRafRef.current = requestAnimationFrame(() => {
        hoverRafRef.current = null;
        const name = countryAt(vec3ToLonLat(hoverPtRef.current))?.properties?.name || null;
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
    <div
      className="v2-map"
      onPointerDownCapture={onCanvasPointerDown}
      onPointerMove={(e) => { pointerRef.current = { x: e.clientX, y: e.clientY, inside: true }; }}
      onPointerLeave={() => { pointerRef.current = null; }}
    >
      <Canvas
        onPointerMissed={onPointerMissed}
        onCreated={onCreated}
        dpr={[t.dpr[0], t.dpr[1]]}
        gl={{ antialias: t.msaa, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        camera={{ fov: CAM.keyframes[0].fov, near: 0.005, far: 100, position: [0, 0.9, HOME_DIST - 0.12] }}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        {!force3d && <PerformanceMonitor onDecline={dropTier} />}
        <FpsGuard minFps={20} onLow={onLowFps} />
        <color attach="background" args={[C.bg]} />
        {geo && <Globe geo={geo} tier={tier} cheap={force3d} tripBlend={tripBlend} onGlobeClick={handleGlobeClick} onGlobeHover={handleGlobeHover} />}
        <HomeRings home={home} still={reducedMotion || (force3d && !pulseQA)} />
        <LegsLayer onHoverPoint={handleDotHover} cinematic={cinematic} legs={legs} activePinId={shownActivePinId} activeLegId={activeLegId} tripBlend={tripBlend} reducedMotion={reducedMotion} lite={force3d} />
        <Stops
          beamHeightRef={beamHeightRef}
          hideBeams={force3d}
          tripBlend={tripBlend}
          items={items}
          activePinId={shownActivePinId}
          hoveredPinId={hoveredPinId}
          reducedMotion={reducedMotion}
          onSelect={(pin) => onPinClick?.(pin)}
          onHover={(pin) => { pinHoverRef.current = !!pin; setHoveredPinId(pin?.id || null); onHoverRegion?.(pin ? countryName(pin.country_code) || pin.location_name || null : null); lastRegionRef.current = null; }}
        />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false}
          enableDamping={!reducedMotion}
          dampingFactor={0.12}
          rotateSpeed={0.5}
          zoomSpeed={0.7}
          minDistance={MIN_DIST}
          maxDistance={MAX_DIST}
          onStart={() => { moveRef.current = null; }}
        />
        {onFirstFrame && <FirstFrame onFirstFrame={onFirstFrame} />}
        <EdgeTagsDriver store={edgeStore} itemsRef={itemsRef} safe={edgeSafe} reducedMotion={reducedMotion} enabled={edgeOn} />
        <RegionProbe pointerRef={pointerRef} draggingRef={draggingRef} pinHoverRef={pinHoverRef} dotHoverRef={dotHoverRef} onPoint={handleRegionPoint} />
        <CameraController homeResumeRef={homeResumeRef} sheetInset={sheetInset} pinHoverRef={pinHoverRef} pointerRef={pointerRef} itemsRef={itemsRef} draggingRef={draggingRef} onDragStart={clearRegionReadout} onDragEndAt={handleGlobeHover} controlsRef={controlsRef} moveRef={moveRef} reducedMotion={reducedMotion} tripView={tripView} tripBlend={tripBlend} labelMix={labelMix} panelOpen={panelOpen} panelWidth={panelWidth} viewRef={viewRef} tripMaxD={cinematic ? MAX_DIST : TRIP_MAX_D} />
        <LabelProjector items={items} labelEls={labelEls} focusing={focusing} maxLabels={t.labels} activePinId={shownActivePinId} meta={labelMeta} clusterRef={clusterRef} labelMix={labelMix} beamHeightRef={beamHeightRef} />
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

      {edgeOn && <EdgeTagsLayer store={edgeStore} onFly={edgeFly} />}
      <div className="v2-frame" style={{ right: panelOpen ? panelWidth : 0 }} aria-hidden={!(tripStops.length && focusTitle)}>
        {/* Corner crosshairs come from the shell (Crosshairs, 10px in); no inner set here. */}
        {tripStops.length > 0 && focusTitle && (
          <TripTitle key={String(focusJourneyId)} title={focusTitle} sub={tripSub} tripBlend={tripBlend} instant={force3d || reducedMotion} lift={stripOn ? STRIP.heightPx : 0} sheetBottom={sheetInset ? sheetInset + 68 : 0} />
        )}
      </div>
      {flyEnabled && !cinematic && (
        <div className="v2-flyover" style={sheetInset
          // Mobile sheet: left of the Add entry button, on the sheet's top edge.
          ? { left: 16, right: "auto", bottom: sheetInset + 12 }
          : { right: (panelOpen ? panelWidth : 0) + 48, bottom: stripOn ? STRIP.insetPx + STRIP.heightPx + STRIP.gapPx : undefined }}>
          <button
            type="button"
            className="v2-flyover-btn"
            aria-pressed={fly.state.playing}
            aria-label={fly.state.playing ? "Pause flyover (Space)" : fly.state.paused ? "Resume flyover (Space)" : "Play flyover (Space)"}
            onClick={fly.toggle}
          >
            {fly.state.playing ? "Pause" : fly.state.paused ? "Resume" : "Play flyover"}
          </button>
          {flyOn && (
            <button type="button" className="v2-flyover-btn is-dim" aria-label="Stop flyover (Esc)" onClick={fly.stop}>Stop</button>
          )}
          <span className="v2-flyover-status" role="status" aria-live="polite">
            {flyOn && fly.state.legIndex >= 0 ? `Leg ${fly.state.legIndex + 1} of ${legs.length}` : ""}
          </span>
        </div>
      )}
      {stripOn && (
        <TimelineStrip
          left={stripLeft}
          right={stripRight}
          lite={force3d}
          reducedMotion={reducedMotion}
          trips={timeline.trips}
          undatedCount={timeline.undatedCount}
          onOpenTrip={timeline.onOpenTrip}
          onOpenReview={timeline.onOpenReview}
          trip={stripTrip}
          currentPinId={shownActivePinId}
          fly={stripTrip && flyEnabled ? fly : null}
          onStopClick={(id) => { if (flyEnabled && fly.seekStop(id)) return; const it = tripStops.find((x) => x.pin.id === id); if (it) onPinClick?.(it.pin); }}
        />
      )}
      {contextLost && (
        <div className="v2-globe-notice" role="status">Globe paused. Graphics were interrupted, reload the page to restore it.</div>
      )}
      <div className="v2-map-overlay">
        {items.map((it, i) => (
          <div
            key={it.pin.id}
            ref={(el) => { labelEls.current[i] = el; }}
            className={`v2-pin-label${it.pin.id === shownActivePinId ? " is-active" : ""}${flyOn && it.pin.id === shownActivePinId ? " is-flyover" : ""}${reducedMotion ? " no-motion" : ""}`}
            style={{ opacity: 0, visibility: "hidden" }}
            onPointerDown={(e) => { labelPressRef.current = true; dragThrough(e); }}
            onClick={(e) => {
              e.stopPropagation();
              if (wasDragged(e)) return;
              if ((clusterRef.current.get(i) || []).length > 1) onClusterTap(i);
              else if (focusing) onPinClick?.(it.pin);
            }}
          >
            <span className="v2-pin-label-place">{it.text}</span>
            <span className="v2-pin-label-coord">{it.coord}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Huge trip title, bottom left of the visible map. Fades in once the camera lands in trip
// view (tripBlend reaches 1). Font size fits the width left of the flyover controls.
function TripTitle({ title, sub, tripBlend, instant = false, lift = 0, sheetBottom = 0 }) {
  const el = useRef(null);
  const [box, setBox] = useState({ w: 930, h: 800 });
  useEffect(() => {
    const parent = el.current?.parentElement;
    if (!parent || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);
  const visW = box.w, H = box.h;
  // Safe area: measure the profile chip so the title block always sits above it.
  const [chipPx, setChipPx] = useState(0);
  const [chipW, setChipW] = useState(0);
  useEffect(() => {
    const measure = () => {
      const chip = document.querySelector(".ui-layer .bottom-left-group");
      const r = chip?.getBoundingClientRect();
      setChipPx(r && r.height > 0 ? Math.max(0, window.innerHeight - r.top) : 0);
      setChipW(r && r.width > 0 ? r.width : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      // Show when the camera lands in trip view (tripBlend 1 at the end of the move) or
      // 1.2 s after the fit starts, whichever is first. Lite and reduced motion: at once.
      if (el.current) el.current.style.opacity = instant || tripBlend.current >= 0.999 || performance.now() - t0 > TRIP_TITLE.fallbackMs ? "1" : "0";
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tripBlend, instant]);
  const text = String(title).toUpperCase();
  const cap = H < 600 ? TRIP_TITLE.phonePx : TRIP_TITLE.maxPx;
  // Mobile sheet: the flyover controls sit below the title, so it can use the full width.
  const room = sheetBottom ? Math.max(120, visW - TRIP_TITLE.left - 24) : Math.max(120, visW - TRIP_TITLE.left - TRIP_TITLE.reserveRight);
  const fit = (len) => room / (Math.max(1, len) * TRIP_TITLE.charW);
  // One line at up to the hero size; if that would drop below about half the hero size,
  // break into two balanced lines at half the hero size so the block height is unchanged.
  let lines = [text];
  let px = Math.min(cap, fit(text.length));
  const words = text.split(/\s+/);
  if (px < cap / 2 && words.length > 1) {
    let best = null;
    for (let k = 1; k < words.length; k++) {
      const a = words.slice(0, k).join(" "), b = words.slice(k).join(" ");
      const m = Math.max(a.length, b.length);
      if (!best || m < best.m) best = { m, l: [a, b] };
    }
    lines = best.l;
    px = Math.min(cap / 2, fit(best.m));
  }
  px = Math.max((sheetBottom ? 20 : TRIP_TITLE.minPx) * (lines.length > 1 ? 0.7 : 1), px);
  return (
    <div ref={el} className="v2-trip-title" style={{ left: TRIP_TITLE.left, bottom: sheetBottom || titleBottomPx(chipPx) + lift, maxWidth: sheetBottom ? `${room}px` : `min(${room}px, calc(100vw - ${Math.round(chipW)}px - 48px))`, opacity: 0, transition: `opacity ${TRIP_TITLE.fadeMs}ms ease` }}>
      <h2 style={{ fontSize: px, lineHeight: TRIP_TITLE.lineHeight, fontWeight: TRIP_TITLE.weight, letterSpacing: TRIP_TITLE.tracking }}>{lines.map((l, i) => <span key={i} style={{ display: "block" }}>{l}</span>)}</h2>
      {sub && (sub.base || sub.km) && (
        <p style={{ fontSize: TRIP_TITLE.subPx, maxWidth: "100%" }}>
          {[sub.base, [sub.counts, visW >= TRIP_TITLE.narrowPx ? sub.km : ""].filter(Boolean).join(" · ")].filter(Boolean).join("   ")}
        </p>
      )}
    </div>
  );
}
