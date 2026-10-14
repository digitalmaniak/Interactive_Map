import { ImageResponse } from "next/og";
import { fetchSharedTrip } from "../../../lib/journeys/shareServer";
import { countsLine, projectRoute, shareLegs, tripDates } from "../../../lib/journeys/shareItinerary";

// Share card, drawn on request and never stored. Anon key plus the share token only. A
// private or deleted trip gets a plain Odyssey card with no trip data.
export const runtime = "edge";
export const alt = "Odyssey trip";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0b0f14";
const CYAN = "#5eeaff";
const W = 1200, H = 630;
const CACHE = { "Cache-Control": "public, max-age=300" };

// Faint grid: 60 px squares.
const GRID = (() => {
  let d = "";
  for (let x = 60; x < W; x += 60) d += `M${x} 0V${H}`;
  for (let y = 60; y < H; y += 60) d += `M0 ${y}H${W}`;
  return d;
})();

const dash = (mode) => (mode === "fly" ? undefined : mode === "walk" ? "1 9" : "12 9");

export default async function Image({ params }) {
  const { token } = await params;
  const [regular, medium, trip] = await Promise.all([
    fetch(new URL("./Inter-Regular.woff", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("./Inter-Medium.woff", import.meta.url)).then((r) => r.arrayBuffer()),
    fetchSharedTrip(token),
  ]);
  const fonts = [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: medium, weight: 500, style: "normal" },
  ];
  const mark = (
    <div style={{ position: "absolute", right: 48, bottom: 40, fontSize: 18, letterSpacing: 6, color: "#8b96a3", fontWeight: 500 }}>ODYSSEY</div>
  );
  const grid = (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
      <path d={GRID} stroke="#ffffff" strokeOpacity="0.045" strokeWidth="1" fill="none" />
    </svg>
  );

  if (!trip) {
    return new ImageResponse(
      (
        <div style={{ width: W, height: H, display: "flex", alignItems: "center", justifyContent: "center", background: BG, fontFamily: "Inter", position: "relative" }}>
          {grid}
          <div style={{ fontSize: 64, color: "#ffffff", letterSpacing: 18, fontWeight: 500 }}>ODYSSEY</div>
        </div>
      ),
      { ...size, fonts, headers: CACHE }
    );
  }

  const legs = shareLegs(trip.legs, trip.pins);
  const { segs, dots } = projectRoute(legs, trip.pins, { width: W, height: H, pad: 0.15 });
  const sub = [tripDates(trip.journey), countsLine(legs)].filter(Boolean).join("  ·  ");
  const title = String(trip.journey.title || "Untitled trip");

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", background: BG, fontFamily: "Inter", position: "relative" }}>
        {grid}
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
          {segs.map((s, i) => (
            <path
              key={i}
              d={s.cx != null ? `M${s.x1} ${s.y1}Q${s.cx} ${s.cy} ${s.x2} ${s.y2}` : `M${s.x1} ${s.y1}L${s.x2} ${s.y2}`}
              stroke={CYAN}
              strokeOpacity={s.mode === "fly" ? 0.9 : 0.75}
              strokeWidth={s.mode === "walk" ? 4 : 3}
              strokeDasharray={dash(s.mode)}
              strokeLinecap="round"
              fill="none"
            />
          ))}
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r="5" fill={CYAN} />
          ))}
        </svg>
        <div style={{ position: "absolute", left: 56, top: 48, right: 56, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 64, color: "#ffffff", fontWeight: 500, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
          {sub && <div style={{ fontSize: 28, color: "#8b96a3", marginTop: 14 }}>{sub}</div>}
        </div>
        {mark}
      </div>
    ),
    { ...size, fonts, headers: CACHE }
  );
}
