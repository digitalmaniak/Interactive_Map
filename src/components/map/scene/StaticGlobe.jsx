"use client";

// Static globe image (v2 dark style) for devices that cannot run the live scene:
// no WebGL, software rendering, or sustained low frame rate. Also used as the
// instant placeholder behind the login form before the live scene loads.
export default function StaticGlobe({ className = "" }) {
  return (
    <div
      className={`v2-map v2-map-static ${className}`.trim()}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, background: "#07090B", pointerEvents: "none", overflow: "hidden" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static decorative asset, no optimization needed */}
      <img
        src="/globe-static.svg"
        alt=""
        decoding="async"
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
    </div>
  );
}
