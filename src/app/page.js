"use client";

import dynamic from "next/dynamic";

// Dynamically import MapCanvas with SSR disabled — client-only map DOM (no SSR document access).
const MapCanvas = dynamic(() => import("../components/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "var(--v2-bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--v2-mono), monospace",
      color: "var(--v2-text-dim)",
      letterSpacing: "0.2em",
      fontSize: "1.25rem"
    }}>
      LOADING
    </div>
  )
});

export default function Home() {
  return (
    <main style={{ width: "100%", height: "100%" }}>
      <MapCanvas />
    </main>
  );
}
