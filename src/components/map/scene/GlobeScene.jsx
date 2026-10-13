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

// v2 main view (DESIGN.md v2: mock A globe, mock C trip framing).
// One perspective camera orbiting a sphere. Draw calls stay tiny for phones:
// globe, atmosphere, coastline, marker dots, beams (5) plus bloom passes when the tier allows.

const C = tokens.color;
const CAM = tokens.camera;
const HOME_DIST = CAM.keyframes[0].distR;
const MIN_DIST = 1.08;
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
function CameraDirector({ controlsRef, moveRef, reducedMotion, tripView, onArrive }) {
  const { camera } = useThree();
  const anim = useRef(null);
  const seen = useRef(null);
  const idleUntil = useRef(0);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (controls) controls.rotateSpeed = THREE.MathUtils.clamp((camera.position.length() - GLOBE_R) * 0.35, 0.03, 0.5);
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
function LabelProjector({ items, labelEls, focusing, maxLabels }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  const camDir = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const close = camera.position.length() < LABEL_DIST;
    let shown = 0;
    items.forEach((it, i) => {
      const el = labelEls.current[i];
      if (!el) return;
      camDir.copy(camera.position).sub(it.pos).normalize();
      const facing = camDir.dot(it.pos.clone().normalize()) > 0.15;
      const show = facing && !it.dimmed && (close || focusing) && shown < maxLabels;
      if (!show) { el.style.opacity = "0"; el.style.visibility = "hidden"; return; }
      shown++;
      v.copy(it.pos).project(camera);
      el.style.visibility = "visible";
      el.style.opacity = "1";
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * size.width}px, ${(-v.y * 0.5 + 0.5) * size.height}px) translate(-50%, calc(-100% - 10px))`;
    });
  });
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
      moveRef.current = { kind: "open", ...tripFraming(stops) };
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
        <CameraDirector controlsRef={controlsRef} moveRef={moveRef} reducedMotion={reducedMotion} tripView={tripView} />
        <LabelProjector items={items} labelEls={labelEls} focusing={focusing} maxLabels={t.labels} />
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
          >
            <span className="v2-pin-label-place">{it.text}</span>
            <span className="v2-pin-label-coord">{it.coord}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
