"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const GlobeScene = dynamic(() => import("./GlobeScene"), { ssr: false, loading: () => null });

// Dim rotating globe behind the login form. Reuses the globe scene in backdrop
// mode: no labels, no markers, no input. Fetches the same static world file.
export default function BackdropGlobe() {
  const [geo, setGeo] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch("/data/countries.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setGeo(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!geo) return null;
  return <GlobeScene geoJson={geo} backdrop />;
}
