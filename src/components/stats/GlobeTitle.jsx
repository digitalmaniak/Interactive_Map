"use client";
// Globe view title (Prism), bottom left: the owner's name and one counts line,
// "17 countries · 23 trips", from profile_stats_v2. Display only, pointer-events none.
const plural = (n, one, many) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

export default function GlobeTitle({ name, stats }) {
  if (!name) return null;
  const line = stats ? [plural(stats.countries, "country", "countries"), plural(stats.trips, "trip", "trips")].join(" · ") : "";
  return (
    <div className="v2-globe-title">
      <h1>{name}</h1>
      {line && <p>{line}</p>}
    </div>
  );
}
