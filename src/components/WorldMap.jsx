"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { geoNaturalEarth1, geoPath, geoContains, geoArea } from "d3-geo";

// d3-geo treats a polygon whose exterior ring is wound backwards as covering
// (almost) the whole sphere — which paints over everything and breaks hit-
// testing. Rewind any such polygon so its area is the smaller (correct) side.
// (Raw GeoJSON like Natural Earth has a few of these, e.g. Bermuda.)
const rewindPolygon = (rings) => {
  if (!rings || !rings.length) return rings;
  if (geoArea({ type: "Polygon", coordinates: [rings[0]] }) > 2 * Math.PI) {
    return [rings[0].slice().reverse(), ...rings.slice(1)];
  }
  return rings;
};
const rewindGeo = (fc) => {
  if (!fc) return fc;
  return {
    ...fc,
    features: fc.features.map((f) => {
      const g = f.geometry;
      if (!g) return f;
      if (g.type === "Polygon") {
        return { ...f, geometry: { ...g, coordinates: rewindPolygon(g.coordinates) } };
      }
      if (g.type === "MultiPolygon") {
        return { ...f, geometry: { ...g, coordinates: g.coordinates.map(rewindPolygon) } };
      }
      return f;
    }),
  };
};

// Flat, editorial 2D world map (replaces the Three.js renderer).
// Renders GeoJSON with d3-geo, supports wheel zoom, drag pan, animated
// fly-to, coral pins with proximity clustering, and hover highlighting.

const MIN_K = 1;
const MAX_K = 14;
const CLUSTER_PX = 30; // proximity radius for clustering, in screen pixels
const EASE = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function WorldMap({
  geoJson,
  statesGeoJson,
  pins = [],
  activePinId = null,
  showPaths = false,
  flyTo = null,
  onPinClick,
  onMapClick,
  onHoverRegion,
}) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredPinId, setHoveredPinId] = useState(null);

  const dragRef = useRef(null);
  const rafRef = useRef(null);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Measure the container so the projection fits real pixels.
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

  // Projection + path generator, fit to the current container size.
  const { projection, pathGen } = useMemo(() => {
    if (!geoJson || size.w === 0 || size.h === 0) return { projection: null, pathGen: null };
    const pad = Math.min(size.w, size.h) * 0.06;
    const proj = geoNaturalEarth1().fitExtent(
      [[pad, pad], [size.w - pad, size.h - pad]],
      { type: "Sphere" }
    );
    return { projection: proj, pathGen: geoPath(proj) };
  }, [geoJson, size.w, size.h]);

  // Rewind any backwards-wound polygons before rendering / hit-testing.
  const cleanGeo = useMemo(() => rewindGeo(geoJson), [geoJson]);
  const cleanStates = useMemo(() => rewindGeo(statesGeoJson), [statesGeoJson]);

  // Precompute country path strings once per projection.
  const countryPaths = useMemo(() => {
    if (!pathGen || !cleanGeo) return [];
    // Key by index — Natural Earth reuses id -99 for several territories.
    return cleanGeo.features.map((f, i) => ({
      key: i,
      name: f.properties?.name || "Unknown",
      d: pathGen(f),
      feature: f,
    }));
  }, [pathGen, cleanGeo]);

  const statePaths = useMemo(() => {
    if (!pathGen || !cleanStates) return [];
    return cleanStates.features.map((f, i) => ({ id: f.id || i, d: pathGen(f) }));
  }, [pathGen, cleanStates]);

  // Index of the country containing the active pin (for the selected tint).
  const selectedIdx = useMemo(() => {
    if (!activePinId || !cleanGeo) return -1;
    const pin = pins.find((p) => p.id === activePinId);
    if (!pin) return -1;
    const pt = [Number(pin.longitude), Number(pin.latitude)];
    return cleanGeo.features.findIndex((feat) => geoContains(feat, pt));
  }, [activePinId, pins, cleanGeo]);

  // Project pins to base (k=1) pixel coords once per projection/pins.
  const projectedPins = useMemo(() => {
    if (!projection) return [];
    return pins
      .map((p) => {
        const xy = projection([Number(p.longitude), Number(p.latitude)]);
        return xy ? { pin: p, bx: xy[0], by: xy[1] } : null;
      })
      .filter(Boolean);
  }, [projection, pins]);

  // Screen-space positions under the current transform.
  const screenPins = useMemo(() => {
    const { k, x, y } = transform;
    return projectedPins.map((pp) => ({ ...pp, sx: pp.bx * k + x, sy: pp.by * k + y }));
  }, [projectedPins, transform]);

  // Greedy proximity clustering in screen space.
  const clusters = useMemo(() => {
    const out = [];
    for (const sp of screenPins) {
      const hit = out.find(
        (c) => Math.hypot(c.sx - sp.sx, c.sy - sp.sy) < CLUSTER_PX
      );
      if (hit) {
        hit.items.push(sp);
        hit.sx = (hit.sx * (hit.items.length - 1) + sp.sx) / hit.items.length;
        hit.sy = (hit.sy * (hit.items.length - 1) + sp.sy) / hit.items.length;
      } else {
        out.push({ sx: sp.sx, sy: sp.sy, items: [sp] });
      }
    }
    return out;
  }, [screenPins]);

  // Connecting path between pins, chronological, drawn in base coords.
  const pathString = useMemo(() => {
    if (!showPaths || projectedPins.length < 2) return null;
    const sorted = [...projectedPins].sort(
      (a, b) =>
        (a.pin.start_date ? new Date(a.pin.start_date).getTime() : Infinity) -
        (b.pin.start_date ? new Date(b.pin.start_date).getTime() : Infinity)
    );
    let d = `M ${sorted[0].bx} ${sorted[0].by}`;
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      const mx = (a.bx + b.bx) / 2;
      const my = (a.by + b.by) / 2 - Math.hypot(b.bx - a.bx, b.by - a.by) * 0.15;
      d += ` Q ${mx} ${my} ${b.bx} ${b.by}`;
    }
    return d;
  }, [showPaths, projectedPins]);

  // --- Zoom / pan helpers -------------------------------------------------
  const clamp = useCallback(
    (t) => {
      const k = Math.max(MIN_K, Math.min(MAX_K, t.k));
      if (k <= 1.0001 || !pathGen) return { k: 1, x: 0, y: 0 };
      const [[x0, y0], [x1, y1]] = pathGen.bounds({ type: "Sphere" });
      const xlo = size.w - x1 * k;
      const xhi = -x0 * k;
      const ylo = size.h - y1 * k;
      const yhi = -y0 * k;
      const cx = xlo > xhi ? (xlo + xhi) / 2 : Math.max(xlo, Math.min(xhi, t.x));
      const cy = ylo > yhi ? (ylo + yhi) / 2 : Math.max(ylo, Math.min(yhi, t.y));
      return { k, x: cx, y: cy };
    },
    [pathGen, size.w, size.h]
  );

  const animateTo = useCallback(
    (target, duration = 750) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const start = transformRef.current;
      const goal = clamp(target);
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        const e = EASE(p);
        setTransform({
          k: start.k + (goal.k - start.k) * e,
          x: start.x + (goal.x - start.x) * e,
          y: start.y + (goal.y - start.y) * e,
        });
        if (p < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [clamp]
  );

  useEffect(() => () => rafRef.current && cancelAnimationFrame(rafRef.current), []);

  // Fly to a target lat/lon when `flyTo` changes.
  useEffect(() => {
    if (!flyTo || !projection || size.w === 0) return;
    const xy = projection([Number(flyTo.lon), Number(flyTo.lat)]);
    if (!xy) return;
    const k = Math.min(MAX_K, 5);
    animateTo({ k, x: size.w / 2 - xy[0] * k, y: size.h / 2 - xy[1] * k });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo]);

  const handleWheel = (e) => {
    if (!pathGen) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const t = transformRef.current;
    const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    const k = Math.max(MIN_K, Math.min(MAX_K, t.k * factor));
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTransform(clamp({ k, x: cx - (cx - t.x) * (k / t.k), y: cy - (cy - t.y) * (k / t.k) }));
  };

  const handlePointerDown = (e) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, orig: transformRef.current, moved: 0 };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };
  const handlePointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    d.moved = Math.max(d.moved, Math.abs(dx) + Math.abs(dy));
    setTransform(clamp({ k: d.orig.k, x: d.orig.x + dx, y: d.orig.y + dy }));
  };
  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const wasDrag = () => dragRef.current && dragRef.current.moved > 4;

  const invertAt = (clientX, clientY) => {
    if (!projection) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const t = transformRef.current;
    const bx = (clientX - rect.left - t.x) / t.k;
    const by = (clientY - rect.top - t.y) / t.k;
    const ll = projection.invert ? projection.invert([bx, by]) : null;
    return ll ? { lon: ll[0], lat: ll[1] } : null;
  };

  const handleBackgroundClick = (e, isLand, feature) => {
    if (dragRef.current && dragRef.current.moved > 4) return;
    const coords = invertAt(e.clientX, e.clientY);
    if (!coords) return;
    onMapClick?.({ ...coords, isLand, country: feature?.properties?.name });
  };

  const handleClusterClick = (c) => {
    const t = transformRef.current;
    const k = Math.min(MAX_K, t.k * 2.2);
    animateTo({ k, x: size.w / 2 - ((c.sx - t.x) / t.k) * k, y: size.h / 2 - ((c.sy - t.y) / t.k) * k }, 500);
  };

  const stateOpacity = Math.max(0, Math.min(0.5, (transform.k - 2.5) / 4));

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, background: "var(--ocean)", overflow: "hidden", cursor: dragRef.current ? "grabbing" : "grab", touchAction: "none" }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => { handlePointerUp(); setHoveredId(null); onHoverRegion?.(null); }}
    >
      {projection && (
        <svg width={size.w} height={size.h} style={{ display: "block" }}>
          {/* Sphere outline (subtle map edge) */}
          <path d={pathGen({ type: "Sphere" })} fill="var(--ocean)" stroke="var(--hairline)" strokeWidth={1} />

          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {/* Countries */}
            {countryPaths.map((c) => {
              const isHover = c.key === hoveredId;
              const isSelected = c.key === selectedIdx;
              return (
                <path
                  key={c.key}
                  d={c.d}
                  fill={isSelected ? "var(--accent-tint)" : isHover ? "var(--land-hover)" : "var(--land)"}
                  stroke={isSelected ? "var(--accent)" : "var(--hairline)"}
                  strokeWidth={isSelected ? 1.25 : 1}
                  vectorEffect="non-scaling-stroke"
                  onClick={(e) => { e.stopPropagation(); handleBackgroundClick(e, true, c.feature); }}
                  onMouseEnter={() => { setHoveredId(c.key); onHoverRegion?.(c.name); }}
                  style={{ transition: "fill 0.18s ease" }}
                />
              );
            })}

            {/* US state subdivisions — fade in when zoomed */}
            {stateOpacity > 0.01 &&
              statePaths.map((s) => (
                <path key={`st-${s.id}`} d={s.d} fill="none" stroke="var(--hairline)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" opacity={stateOpacity} pointerEvents="none" />
              ))}

            {/* Connecting trip path */}
            {pathString && (
              <path d={pathString} fill="none" stroke="var(--accent)" strokeWidth={1.25} strokeOpacity={0.5} strokeDasharray="4 5" vectorEffect="non-scaling-stroke" pointerEvents="none" />
            )}
          </g>

          {/* Transparent ocean catcher for background clicks */}
          <rect x={0} y={0} width={size.w} height={size.h} fill="transparent" onClick={(e) => handleBackgroundClick(e, false, null)} style={{ pointerEvents: "none" }} />

          {/* Pins + clusters overlay (fixed pixel sizes) */}
          <g>
            {clusters.map((c, i) => {
              if (c.items.length > 1) {
                return (
                  <g key={`cl-${i}`} transform={`translate(${c.sx},${c.sy})`} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); handleClusterClick(c); }}>
                    <circle r={15} fill="var(--accent)" fillOpacity={0.18} />
                    <circle r={11} fill="var(--accent)" />
                    <text textAnchor="middle" dy="0.35em" fontSize="11" fontWeight="700" fill="#fff">{c.items.length}</text>
                  </g>
                );
              }
              const sp = c.items[0];
              const active = sp.pin.id === activePinId;
              const hover = sp.pin.id === hoveredPinId;
              const r = active ? 7 : hover ? 6 : 5;
              return (
                <g
                  key={sp.pin.id}
                  transform={`translate(${sp.sx},${sp.sy})`}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); onPinClick?.(sp.pin); }}
                  onMouseEnter={() => setHoveredPinId(sp.pin.id)}
                  onMouseLeave={() => setHoveredPinId(null)}
                >
                  {active && <circle r={13} fill="var(--accent)" fillOpacity={0.16} />}
                  <circle r={r + 1.5} fill="#fff" />
                  <circle r={r} fill="var(--accent)" />
                  {active && <circle r={2.2} fill="#fff" />}
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
