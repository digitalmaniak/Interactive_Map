"use client";

import dynamic from "next/dynamic";

// Client only: WebGL has no server render.
const MapScene = dynamic(() => import("./MapScene"), {
  ssr: false,
  loading: () => <div className="v2-map" aria-busy="true" />,
});

export default MapScene;
