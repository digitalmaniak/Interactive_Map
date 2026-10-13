"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { geoContains } from "d3-geo";
import { GLOBE_R, rewindGeo, lonLatToVec3, vec3ToLonLat, buildLandTexture, buildCoastGeometry } from "./geometry";
import { createGlobeMaterial } from "./GlobeMaterial";

// v2 main view (VISION.md, mock A globe with mock C trip framing).
// One React Three Fiber scene: perspective camera orbiting a sphere. Draw calls
// are kept tiny for phones: globe (1), coastline (1), markers (1 instanced).

const V2 = {
  landDark: "#1F2022",
  landLight: "#282A2D",
  ocean: "#2D3A42",
  hatch: "#5CC8E4",
  coast: "#9FB4BF",
  marker: "#5CC8E4",
  accent: "#FF3311",
  bg: "#15171A",
};

const HOME_DIST = 3.2;
const MIN_DIST = 1.15;
const MAX_DIST = 6;
const LABEL_DIST = 2.0; // labels appear once the camera is this close, or for trip stops
const DRAG_PX = 5;
const smooth = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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

// Camera move target for a set of lon/lat points: tilted close view (mock C).
function framingFor(points) {
  const c = new THREE.Vector3();
  for (const p of points) c.add(lonLatToVec3(p.lon, p.lat));
  if (c.lengthSq() < 1e-6) c.set(0, 0, 1);
  c.normalize();
  let spread = 0;
  for (const p of points) spread = Math.max(spread, c.angleTo(lonLatToVec3(p.lon, p.lat)));
  const target = c.clone().multiplyScalar(GLOBE_R);
  const height = THREE.MathUtils.clamp(0.25 + spread * 2.2, 0.3, 2.4);
  // Tilt: back the camera off toward the south of the target along the local meridian.
  const north = new THREE.Vector3(0, 1, 0).sub(c.clone().multiplyScalar(c.y)).normalize();
  const position = target.clone().add(c.clone().multiplyScalar(height)).add(north.multiplyScalar(-height * 0.7));
  return { position, target };
}

function Globe({ geo, onGlobeClick, onGlobeHover }) {
  const { gl } = useThree();
  const { material, coast, tex } = useMemo(() => {
    const max = gl.capabilities.maxTextureSize || 4096;
    const t = buildLandTexture(geo, Math.min(4096, max));
    return { tex: t, material: createGlobeMaterial(t, V2), coast: buildCoastGeometry(geo) };
  }, [geo, gl]);
  useEffect(() => () => { material.dispose(); coast.dispose(); tex.dispose(); }, [material, coast, tex]);
  return (
    <group>
      <mesh
        material={material}
        onClick={(e) => { if (e.delta > DRAG_PX) return; onGlobeClick(e.point); }}
        onPointerMove={(e) => onGlobeHover(e.point)}
        onPointerOut={() => onGlobeHover(null)}
      >
        <sphereGeometry args={[GLOBE_R, 128, 96]} />
      </mesh>
      <lineSegments geometry={coast} raycast={() => null}>
        <lineBasicMaterial color={V2.coast} transparent opacity={0.7} />
      </lineSegments>
    </group>
  );
}

// All places in one InstancedMesh. Per instance colour handles active and dimmed.
function Markers({ items, activePinId, hoveredPinId, onSelect, onHover }) {
  const ref = useRef();
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const { camera } = useThree();
  const count = items.length;

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    // Constant on screen size: scale with camera distance to the surface.
    const dist = camera.position.length() - GLOBE_R;
    const base = THREE.MathUtils.clamp(dist * 0.012, 0.0015, 0.04);
    items.forEach((it, i) => {
      const active = it.pin.id === activePinId;
      const hover = it.pin.id === hoveredPinId;
      tmp.position.copy(it.pos);
      tmp.lookAt(it.pos.clone().multiplyScalar(2));
      const s = base * (active ? 1.6 : hover ? 1.3 : 1);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      color.set(active ? V2.accent : V2.marker);
      if (it.dimmed) color.multiplyScalar(0.3);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (!count) return null;
  return (
    <instancedMesh
      key={count}
      ref={ref}
      args={[undefined, undefined, count]}
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
  );
}

// Eased drone camera. Move requests arrive through a ref and are picked up on
// the next frame. Reduced motion: instant cut. User drag cancels a move.
function CameraDirector({ controlsRef, moveRef, reducedMotion }) {
  const { camera } = useThree();
  const anim = useRef(null);
  const seen = useRef(null);

  useFrame(() => {
    const controls = controlsRef.current;
    const req = moveRef.current;
    // Slow the orbit near the surface so close views stay controllable.
    if (controls) controls.rotateSpeed = THREE.MathUtils.clamp((camera.position.length() - GLOBE_R) * 0.35, 0.04, 0.5);
    if (req !== seen.current) {
      seen.current = req;
      anim.current = null;
      if (req) {
        if (reducedMotion) {
          camera.position.copy(req.position);
          controls?.target.copy(req.target);
          controls?.update();
        } else {
          const from = { position: camera.position.clone(), target: controls ? controls.target.clone() : new THREE.Vector3() };
          anim.current = { from, to: req, t0: performance.now(), dur: req.duration || 1400 };
        }
      }
    }
    const a = anim.current;
    if (!a) return;
    const p = Math.min(1, (performance.now() - a.t0) / a.dur);
    const e = smooth(p);
    // Arc the move over the globe instead of cutting through it.
    const r0 = a.from.position.length(), r1 = a.to.position.length();
    const dir = a.from.position.clone().normalize().lerp(a.to.position.clone().normalize(), e).normalize();
    const lift = Math.sin(Math.PI * e) * 0.35 * a.from.position.angleTo(a.to.position);
    camera.position.copy(dir.multiplyScalar(THREE.MathUtils.lerp(r0, r1, e) + lift));
    controls?.target.lerpVectors(a.from.target, a.to.target, e);
    controls?.update();
    if (p >= 1) anim.current = null;
  });
  return null;
}

// HTML labels above the canvas, positioned each frame without React re-renders.
function LabelProjector({ items, labelEls, focusing }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  const camDir = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const close = camera.position.length() < LABEL_DIST;
    items.forEach((it, i) => {
      const el = labelEls.current[i];
      if (!el) return;
      camDir.copy(camera.position).sub(it.pos).normalize();
      const facing = camDir.dot(it.pos.clone().normalize()) > 0.15;
      const show = facing && !it.dimmed && (close || (focusing && !it.dimmed));
      if (!show) { el.style.opacity = "0"; return; }
      v.copy(it.pos).project(camera);
      el.style.opacity = "1";
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * size.width}px, ${(-v.y * 0.5 + 0.5) * size.height}px) translate(-50%, calc(-100% - 8px))`;
    });
  });
  return null;
}

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
  const controlsRef = useRef(null);
  const labelEls = useRef([]);
  const lastRegionRef = useRef(null);
  const hoverRafRef = useRef(null);
  const [hoveredPinId, setHoveredPinId] = useState(null);
  const moveRef = useRef(null);

  const geo = useMemo(() => rewindGeo(geoJson), [geoJson]);
  const focusing = focusJourneyId != null && !String(focusJourneyId).startsWith("__");

  const items = useMemo(
    () =>
      pins
        .filter((p) => Number.isFinite(Number(p.longitude)) && Number.isFinite(Number(p.latitude)))
        .map((p) => ({
          pin: p,
          lon: Number(p.longitude),
          lat: Number(p.latitude),
          pos: lonLatToVec3(Number(p.longitude), Number(p.latitude), GLOBE_R * 1.003),
          dimmed: focusing && p.journey_id !== focusJourneyId,
          text: (p.location_name || "").split(",")[0].trim() || p.title || "",
        })),
    [pins, focusing, focusJourneyId]
  );

  // Opening a trip eases into a tilted close view over its stops. Closing eases back out.
  const focusKeyRef = useRef(null);
  useEffect(() => {
    const key = focusing ? String(focusJourneyId) : null;
    const stops = items.filter((it) => !it.dimmed);
    if (key === focusKeyRef.current) return;
    if (key != null && stops.length === 0) return; // wait for pins
    const prev = focusKeyRef.current;
    focusKeyRef.current = key;
    if (key != null) {
      moveRef.current = { ...framingFor(stops), duration: 1600 };
    } else if (prev != null) {
      const dir = controlsRef.current?.object.position.clone().normalize() || new THREE.Vector3(0, 0, 1);
      moveRef.current = { position: dir.multiplyScalar(HOME_DIST), target: new THREE.Vector3(), duration: 1400 };
    }
  }, [focusing, focusJourneyId, items]);

  useEffect(() => {
    if (!flyTo) return;
    const lon = Number(flyTo.lon), lat = Number(flyTo.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    const f = framingFor([{ lon, lat }]);
    moveRef.current = { ...f, duration: 1300 };
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

  return (
    <div className="v2-map">
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 35, near: 0.01, far: 100, position: [0, 0.6, HOME_DIST] }}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        <color attach="background" args={[V2.bg]} />
        {geo && <Globe geo={geo} onGlobeClick={handleGlobeClick} onGlobeHover={handleGlobeHover} />}
        <Markers
          items={items}
          activePinId={activePinId}
          hoveredPinId={hoveredPinId}
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
        <CameraDirector controlsRef={controlsRef} moveRef={moveRef} reducedMotion={reducedMotion} />
        <LabelProjector items={items} labelEls={labelEls} focusing={focusing} />
      </Canvas>

      <div className="v2-map-overlay">
        {items.map((it, i) => (
          <div
            key={it.pin.id}
            ref={(el) => { labelEls.current[i] = el; }}
            className={`v2-pin-label${it.pin.id === activePinId ? " is-active" : ""}`}
            style={{ opacity: 0 }}
          >
            {it.text}
          </div>
        ))}
      </div>
    </div>
  );
}
