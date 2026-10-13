"use client";

// Static globe image (v2 dark style) for devices that cannot run the live scene:
// no WebGL, software rendering, or sustained low frame rate. Also the instant
// placeholder behind the login form until the live scene draws its first frame.
//
// Framing matches the R3F camera: three.js fov is vertical, so the projected
// sphere radius depends only on canvas height:
//   rPx = (H / 2) * tan(asin(R / dist)) / tan(fov / 2)
// The SVG draws the globe with radius 440 in a 1200 square, so the image height
// is scaled to make its circle land exactly on the 3D silhouette, centered.
const SVG_SIZE = 1200;
const SVG_R = 440;

export function globeImageHeightPct({ fov = 35, dist = 3, radius = 1 } = {}) {
  const half = (fov * Math.PI) / 360;
  const rOverHalfH = Math.tan(Math.asin(radius / dist)) / Math.tan(half);
  return rOverHalfH * 0.5 * (SVG_SIZE / SVG_R) * 100;
}

export default function StaticGlobe({ className = "", visible = true, framing, fadeMs = 400, offsetX = 0 }) {
  const heightPct = globeImageHeightPct(framing);
  return (
    <div
      className={`v2-map v2-map-static ${className}`.trim()}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        background: "#07090B",
        pointerEvents: "none",
        overflow: "hidden",
        opacity: visible ? 1 : 0,
        transition: `opacity ${fadeMs}ms ease`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static decorative asset, no optimization needed */}
      <img
        src="/globe-static.svg"
        alt=""
        decoding="async"
        draggable={false}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          height: `${heightPct}%`,
          width: "auto",
          aspectRatio: "1 / 1",
          maxWidth: "none",
          transform: `translate(calc(-50% - ${offsetX}px), -50%)`,
          transition: `transform ${offsetX ? 1600 : 1200}ms cubic-bezier(0.65, 0, 0.35, 1)`,
          display: "block",
        }}
      />
    </div>
  );
}
