"use client";

import dynamic from "next/dynamic";

// Dynamically import MapCanvas with SSR disabled — client-only map DOM (no SSR document access).
const MapCanvas = dynamic(() => import("../components/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "#1a0210",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-orbitron), monospace",
      color: "#f8fafc",
      letterSpacing: "0.2em",
      fontSize: "1.25rem"
    }}>
      LOADING SYSTEM CONTEXT...
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
