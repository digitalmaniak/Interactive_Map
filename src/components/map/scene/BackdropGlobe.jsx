"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import StaticGlobe from "./StaticGlobe";
import { detectRenderTier } from "./renderTier";

const GlobeScene = dynamic(() => import("./GlobeScene"), { ssr: false, loading: () => null });

// Same camera as the GlobeScene backdrop Canvas, so the image sits on the 3D silhouette.
export const BACKDROP_FRAMING = { fov: 35, dist: 3, radius: 1 };

// Dim rotating globe behind the login form. The form must be usable first, so:
// the static globe image paints immediately, and the live scene (code split, client
// only) starts only after first paint plus an idle callback. The image crossfades
// out only after the scene has drawn its first frame, and fades back in if the
// scene falls back (low fps). One wrapper carries the dim opacity so the two
// layers never show through each other. Uses the low poly 110m world file.
export default function BackdropGlobe() {
  const [geo, setGeo] = useState(null);
  const [live, setLive] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let idleId = 0;
    let timeoutId = 0;
    const start = () => {
      if (!alive || detectRenderTier() === "static") return;
      fetch("/data/countries-110m.json")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (alive && j) setGeo(j); })
        .catch(() => {});
    };
    const raf = requestAnimationFrame(() => {
      if ("requestIdleCallback" in window) idleId = window.requestIdleCallback(start, { timeout: 2500 });
      else timeoutId = window.setTimeout(start, 400);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (idleId) window.cancelIdleCallback?.(idleId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const onFirstFrame = useCallback(() => setLive(true), []);
  const onFallback = useCallback(() => { setFailed(true); setLive(false); }, []);

  return (
    <div className="v2-map v2-map-backdrop" aria-hidden="true" style={{ pointerEvents: "none" }}>
      {geo && !failed ? <GlobeScene geoJson={geo} backdrop onFirstFrame={onFirstFrame} onFallback={onFallback} /> : null}
      <StaticGlobe visible={!live} framing={BACKDROP_FRAMING} />
    </div>
  );
}
