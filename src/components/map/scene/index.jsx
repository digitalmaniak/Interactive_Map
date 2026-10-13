"use client";

import dynamic from "next/dynamic";

// Client only: WebGL has no server render.
const MapScene = dynamic(() => import("./GlobeScene"), {
  ssr: false,
  loading: () => <div className="v2-map" aria-busy="true" />,
});

export default MapScene;
