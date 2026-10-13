"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { geoNaturalEarth1, geoContains } from "d3-geo";
import { rewindGeo, buildLandGeometry, buildSphereGeometry } from "./geometry";
import { createOceanMaterial } from "./OceanMaterial";

// v2 map scene (DESIGN.md "v2 Anduril direction", mock B).
// A real React Three Fiber scene viewed straight down through an orthographic
// camera. The map transform { k, x, y } is the same screen space model the old
// SVG map used, so pan, zoom, fit and fly behave exactly as before. Tilting
// into 3D later is only a camera change, the scene stays the same.

const V2 = {
  land: "#24262A", // inside the #1F2022 to #282A2D range
  ocean: "#2D3A42",
  hatch: "#5CC8E4",
  coast: "#8FA3AE",
  marker: "#5CC8E4",
  accent: "#FF3311",
};

const MIN_K = 1;
const MAX_K = 32;
const CLUSTER_PX = 30;
const EASE = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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

// Drives the orthographic camera from the 2D map transform. Flat view only, no rotation.
function CameraRig({ transform, size }) {
  const { camera, invalidate } = useThree();
  useEffect(() => {
    if (!size.w) return;
    // eslint-disable-next-line react-hooks/immutability -- three.js cameras are mutated imperatively
    camera.zoom = transform.k;
    camera.position.set((size.w / 2 - transform.x) / transform.k, -(size.h / 2 - transform.y) / transform.k, 500);
    camera.up.set(0, 1, 0);
    camera.lookAt(camera.position.x, camera.position.y, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, transform, size.w, size.h]);
  return null;
}

function World({ projection, geo }) {
  const { land, coast, sphere } = useMemo(() => {
    const g = buildLandGeometry(projection, geo);
    return { ...g, sphere: buildSphereGeometry(projection) };
  }, [projection, geo]);
  const oceanMat = useMemo(() => createOceanMaterial({ base: V2.ocean, hatch: V2.hatch }), []);
  useEffect(() => () => { land.dispose(); coast.dispose(); sphere.dispose(); }, [land, coast, sphere]);
  useEffect(() => () => oceanMat.dispose(), [oceanMat]);
  return (
    <group>
      <mesh geometry={sphere} material={oceanMat} position={[0, 0, 0]} />
      <mesh geometry={land} position={[0, 0, 0.5]}>
        <meshBasicMaterial color={V2.land} />
      </mesh>
      <lineSegments geometry={coast} position={[0, 0, 1]}>
        <lineBasicMaterial color={V2.coast} transparent opacity={0.85} />
      </lineSegments>
    </group>
  );
}

// Marker: flat disc plus ring, sized in screen pixels (scaled by 1/k).
function Marker({ x, y, k, active, hover, dimmed, count = 1, onSelect, onOver, onOut }) {
  const s = 1 / k;
  const r = count > 1 ? 9 : active ? 6 : hover ? 5 : 4;
  const color = active ? V2.accent : V2.marker;
  return (
    <group position={[x, -y, 2 + (active ? 1 : 0)]} scale={[s, s, 1]}>
      <mesh
        onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(); } : undefined}
        onPointerOver={onOver}
        onPointerOut={onOut}
        visible
      >
        <circleGeometry args={[Math.max(r + 6, 10), 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[r + 1.5, r + 3, 32]} />
        <meshBasicMaterial color={color} transparent opacity={dimmed ? 0.12 : count > 1 ? 0.35 : 0.5} />
      </mesh>
      <mesh>
        <circleGeometry args={[r, 32]} />
        <meshBasicMaterial color={color} transparent opacity={dimmed ? 0.25 : 1} />
      </mesh>
    </group>
  );
}

export default function MapScene({
  geoJson,
  pins = [],
  activePinId = null,
  focusJourneyId = null,
  flyTo = null,
  onPinClick,
  onMapClick,
  onHoverRegion,
  onClusterClick,
}) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [hoveredPinId, setHoveredPinId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const markerHitRef = useRef(false); // set when a marker handled this click
  const rafRef = useRef(null);
  const hoverRafRef = useRef(null);
  const lastRegionRef = useRef(null);
  const transformRef = useRef(transform);
  useEffect(() => { transformRef.current = transform; }, [transform]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cleanGeo = useMemo(() => rewindGeo(geoJson), [geoJson]);

  const { projection, bounds } = useMemo(() => {
    if (!geoJson || size.w === 0 || size.h === 0) return { projection: null, bounds: null };
    const pad = Math.min(size.w, size.h) * 0.06;
    const proj = geoNaturalEarth1().fitExtent([[pad, pad], [size.w - pad, size.h - pad]], { type: "Sphere" });
    const xs = [], ys = [];
    for (const lon of [-180, 0, 180]) for (const lat of [-90, 0, 90]) {
      const p = proj([lon, lat]);
      xs.push(p[0]); ys.push(p[1]);
    }
    return { projection: proj, bounds: [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]] };
  }, [geoJson, size.w, size.h]);

  const projectedPins = useMemo(() => {
    if (!projection) return [];
    return pins
      .map((p) => {
        const xy = projection([Number(p.longitude), Number(p.latitude)]);
        return xy && Number.isFinite(xy[0]) ? { pin: p, bx: xy[0], by: xy[1] } : null;
      })
      .filter(Boolean);
  }, [projection, pins]);

  const focusing = focusJourneyId != null && !String(focusJourneyId).startsWith("__");
  const { projectedFocus, projectedDimmed } = useMemo(() => {
    if (!focusing) return { projectedFocus: projectedPins, projectedDimmed: [] };
    const focus = [], dimmed = [];
    for (const pp of projectedPins) (pp.pin.journey_id === focusJourneyId ? focus : dimmed).push(pp);
    return { projectedFocus: focus, projectedDimmed: dimmed };
  }, [projectedPins, focusing, focusJourneyId]);

  const screenPins = useMemo(() => {
    const { k, x, y } = transform;
    return projectedFocus.map((pp) => ({ ...pp, sx: pp.bx * k + x, sy: pp.by * k + y }));
  }, [projectedFocus, transform]);

  const clusters = useMemo(() => {
    const out = [];
    for (const sp of screenPins) {
      const hit = out.find((c) => Math.hypot(c.sx - sp.sx, c.sy - sp.sy) < CLUSTER_PX);
      if (hit) {
        hit.items.push(sp);
        const n = hit.items.length;
        hit.sx = (hit.sx * (n - 1) + sp.sx) / n;
        hit.sy = (hit.sy * (n - 1) + sp.sy) / n;
      } else out.push({ sx: sp.sx, sy: sp.sy, items: [sp] });
    }
    return out;
  }, [screenPins]);

  // --- Zoom / pan ---------------------------------------------------------
  const clamp = useCallback(
    (t) => {
      const k = Math.max(MIN_K, Math.min(MAX_K, t.k));
      if (k <= 1.0001 || !bounds) return { k: 1, x: 0, y: 0 };
      const [[x0, y0], [x1, y1]] = bounds;
      const xlo = size.w - x1 * k, xhi = -x0 * k, ylo = size.h - y1 * k, yhi = -y0 * k;
      const cx = xlo > xhi ? (xlo + xhi) / 2 : Math.max(xlo, Math.min(xhi, t.x));
      const cy = ylo > yhi ? (ylo + yhi) / 2 : Math.max(ylo, Math.min(yhi, t.y));
      return { k, x: cx, y: cy };
    },
    [bounds, size.w, size.h]
  );

  // Eased drone style camera moves. Reduced motion: instant cut.
  const animateTo = useCallback(
    (target, duration = 750) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const goal = clamp(target);
      if (reducedMotion) { rafRef.current = requestAnimationFrame(() => setTransform(goal)); return; }
      const start = transformRef.current;
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        const e = EASE(p);
        setTransform({ k: start.k + (goal.k - start.k) * e, x: start.x + (goal.x - start.x) * e, y: start.y + (goal.y - start.y) * e });
        if (p < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [clamp, reducedMotion]
  );

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
  }, []);

  useEffect(() => {
    if (!flyTo || !projection || size.w === 0) return;
    const xy = projection([Number(flyTo.lon), Number(flyTo.lat)]);
    if (!xy) return;
    const k = MAX_K;
    const visW = Math.max(220, size.w - 360);
    animateTo({ k, x: visW / 2 - xy[0] * k, y: size.h / 2 - xy[1] * k });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo]);

  // Native non-passive wheel listener so the page never scrolls under the map.
  const wheelRef = useRef(null);
  const onWheel = (e) => {
    if (!bounds) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const t = transformRef.current;
    const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    const k = Math.max(MIN_K, Math.min(MAX_K, t.k * factor));
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTransform(clamp({ k, x: cx - (cx - t.x) * (k / t.k), y: cy - (cy - t.y) * (k / t.k) }));
  };
  useEffect(() => { wheelRef.current = onWheel; });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const fn = (e) => wheelRef.current?.(e);
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, []);

  const invertAt = (clientX, clientY) => {
    if (!projection) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const t = transformRef.current;
    const ll = projection.invert([(clientX - rect.left - t.x) / t.k, (clientY - rect.top - t.y) / t.k]);
    return ll && Number.isFinite(ll[0]) ? { lon: ll[0], lat: ll[1] } : null;
  };

  const countryAt = (coords) => {
    if (!coords || !cleanGeo) return null;
    return cleanGeo.features.find((f) => geoContains(f, [coords.lon, coords.lat])) || null;
  };

  const handlePointerDown = (e) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, orig: transformRef.current, moved: 0 };
    movedRef.current = false;
    markerHitRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };
  const handlePointerMove = (e) => {
    const d = dragRef.current;
    if (d) {
      const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
      d.moved = Math.max(d.moved, Math.abs(dx) + Math.abs(dy));
      if (d.moved > 4) { movedRef.current = true; if (!dragging) setDragging(true); }
      if (movedRef.current) setTransform(clamp({ k: d.orig.k, x: d.orig.x + dx, y: d.orig.y + dy }));
      return;
    }
    if (hoveredPinId || hoverRafRef.current) return;
    const { clientX, clientY } = e;
    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = null;
      const name = countryAt(invertAt(clientX, clientY))?.properties?.name || null;
      if (name !== lastRegionRef.current) { lastRegionRef.current = name; onHoverRegion?.(name); }
    });
  };
  const handlePointerUp = () => { dragRef.current = null; setDragging(false); };

  const handleClick = (e) => {
    if (movedRef.current || markerHitRef.current) { markerHitRef.current = false; return; }
    const coords = invertAt(e.clientX, e.clientY);
    if (!coords) return;
    const feature = countryAt(coords);
    onMapClick?.({ ...coords, isLand: !!feature, country: feature?.properties?.name });
  };

  const fitToProjected = useCallback(
    (items, duration = 700) => {
      if (!items || items.length === 0 || size.w === 0) return;
      const xs = items.map((it) => it.bx), ys = items.map((it) => it.by);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const bw = Math.max(Math.max(...xs) - Math.min(...xs), 1), bh = Math.max(Math.max(...ys) - Math.min(...ys), 1);
      const pad = 130;
      const visW = Math.max(220, size.w - 360);
      const minK = items.length === 1 ? 4 : 2.5;
      const k = Math.max(minK, Math.min(MAX_K, Math.min((visW - 2 * pad) / bw, (size.h - 2 * pad) / bh)));
      animateTo({ k, x: visW / 2 - cx * k, y: size.h / 2 - cy * k }, duration);
    },
    [animateTo, size.w, size.h]
  );

  // Journey drill in: fit to journey pins. Leaving: gentle world overview.
  const focusFitRef = useRef({ key: null, fitted: false });
  useEffect(() => {
    if (!projection || size.w === 0) return;
    const key = focusing ? String(focusJourneyId) : null;
    const prev = focusFitRef.current;
    if (key !== prev.key) {
      focusFitRef.current = { key, fitted: false };
      if (key == null && prev.key != null) {
        animateTo({ k: 1, x: 0, y: 0 }, 650);
        focusFitRef.current = { key: null, fitted: true };
        return;
      }
    }
    if (key != null && !focusFitRef.current.fitted && projectedFocus.length > 0) {
      fitToProjected(projectedFocus, 700);
      focusFitRef.current = { key, fitted: true };
    }
  }, [focusJourneyId, focusing, projection, size.w, size.h, projectedFocus, fitToProjected, animateTo]);

  // Base (unzoomed) coords of a cluster centre, for the 3D marker.
  const toBase = (sx, sy) => [(sx - transform.x) / transform.k, (sy - transform.y) / transform.k];

  const labelOpacity = Math.max(0, Math.min(1, (transform.k - 5) / 4));
  const labels = (() => {
    if (labelOpacity <= 0.01) return [];
    const BOX_H = 19, GAP = 5, BASE = 14, STEP = 7, MAX = 220;
    const items = clusters
      .filter((c) => c.items.length === 1)
      .map((c) => {
        const sp = c.items[0];
        const text = (sp.pin.location_name || "").split(",")[0].trim() || sp.pin.title || "";
        return { id: sp.pin.id, sx: sp.sx, sy: sp.sy, text, w: text.length * 7.4 + 18 };
      })
      .filter((it) => it.text && it.sx > -200 && it.sx < size.w + 200 && it.sy > -100 && it.sy < size.h + 200);
    items.sort((a, b) => a.sy - b.sy || a.sx - b.sx);
    const placed = [];
    for (const it of items) {
      let line = BASE;
      const box = () => ({ x1: it.sx - it.w / 2, x2: it.sx + it.w / 2, y1: it.sy - line - BOX_H, y2: it.sy - line });
      let r = box(), guard = 0;
      while (guard < 60 && line < MAX && placed.some((p) => !(r.x2 < p.x1 - GAP || r.x1 > p.x2 + GAP || r.y2 < p.y1 - GAP || r.y1 > p.y2 + GAP))) {
        line += STEP; r = box(); guard++;
      }
      it.line = line;
      placed.push(r);
    }
    return items;
  })();

  const selectMarker = (fn) => {
    markerHitRef.current = true;
    if (movedRef.current) return;
    fn();
  };

  return (
    <div
      ref={containerRef}
      className="v2-map"
      style={{ cursor: dragging ? "grabbing" : "grab" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => { handlePointerUp(); lastRegionRef.current = null; onHoverRegion?.(null); }}
      onClick={handleClick}
    >
      {projection && (
        <Canvas
          orthographic
          frameloop="demand"
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 0, 500], near: 0.1, far: 2000, zoom: 1 }}
          style={{ position: "absolute", inset: 0 }}
          aria-hidden="true"
        >
          <color attach="background" args={["#1A1C1E"]} />
          <CameraRig transform={transform} size={size} />
          <World projection={projection} geo={cleanGeo} />
          {projectedDimmed.map((pp) => (
            <Marker key={`dim-${pp.pin.id}`} x={pp.bx} y={pp.by} k={transform.k} dimmed />
          ))}
          {clusters.map((c) => {
            const [bx, by] = toBase(c.sx, c.sy);
            if (c.items.length > 1) {
              const key = `cl-${c.items.map((it) => it.pin.id).join("-")}`;
              const firstLoc = [...c.items].sort(
                (a, b) => (a.pin.start_date ? new Date(a.pin.start_date).getTime() : Infinity) - (b.pin.start_date ? new Date(b.pin.start_date).getTime() : Infinity)
              )[0].pin.location_name;
              return (
                <Marker
                  key={key}
                  x={bx}
                  y={by}
                  k={transform.k}
                  count={c.items.length}
                  onSelect={() => selectMarker(() => { fitToProjected(c.items, 600); onClusterClick?.(c.items.map((it) => it.pin)); })}
                  onOver={() => onHoverRegion?.(firstLoc)}
                  onOut={() => onHoverRegion?.(null)}
                />
              );
            }
            const sp = c.items[0];
            return (
              <Marker
                key={sp.pin.id}
                x={sp.bx}
                y={sp.by}
                k={transform.k}
                active={sp.pin.id === activePinId}
                hover={sp.pin.id === hoveredPinId}
                onSelect={() => selectMarker(() => onPinClick?.(sp.pin))}
                onOver={() => { setHoveredPinId(sp.pin.id); onHoverRegion?.(sp.pin.location_name); }}
                onOut={() => { setHoveredPinId(null); onHoverRegion?.(null); }}
              />
            );
          })}
        </Canvas>
      )}

      {/* HTML overlay above the canvas: cluster counts and pin labels stay sharp and accessible */}
      <div className="v2-map-overlay">
        {clusters.filter((c) => c.items.length > 1).map((c) => (
          <div key={`cn-${c.items.map((it) => it.pin.id).join("-")}`} className="v2-cluster-count" style={{ left: c.sx, top: c.sy }}>
            {c.items.length}
          </div>
        ))}
        {labels.map((it) => (
          <div
            key={`lbl-${it.id}`}
            className="v2-pin-label"
            style={{ left: it.sx, top: it.sy - 6, opacity: labelOpacity }}
          >
            <div className="v2-pin-label-box">{it.text}</div>
            <div className="v2-pin-label-line" style={{ height: it.line }} />
          </div>
        ))}
      </div>
    </div>
  );
}
