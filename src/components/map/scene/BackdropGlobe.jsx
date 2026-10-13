"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import StaticGlobe from "./StaticGlobe";
import { detectRenderTier } from "./renderTier";

const GlobeScene = dynamic(() => import("./GlobeScene"), { ssr: false, loading: () => null });

// Dim rotating globe behind the login form. The form must be usable first, so:
// the static globe image paints immediately, and the live scene (code split, client
// only) starts only after first paint plus an idle callback. Devices without WebGL
// or on a software renderer keep the static image. Uses the low poly 110m world file.
export default function BackdropGlobe() {
  const [geo, setGeo] = useState(null);

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

  return (
    <>
      <StaticGlobe className="v2-map-backdrop" />
      {geo ? <GlobeScene geoJson={geo} backdrop /> : null}
    </>
  );
}
