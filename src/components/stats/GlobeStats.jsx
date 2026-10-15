"use client";
// Small read-only stats panel on the globe: countries, miles flown, trips per year.
// Countries and flown distance from profile_stats_v2 (km, shown in miles); trips per year
// from journeys.date_start. Hidden in trip view.
import { useMemo } from "react";
import { kmToMi } from "../../lib/units/distance";
import { tripsPerYear } from "../../lib/stats/tripsPerYear";

const fmt = (n) => Math.round(n).toLocaleString("en-US");

export default function GlobeStats({ stats, journeys, right = 24 }) {
  const years = useMemo(() => tripsPerYear(journeys), [journeys]);
  if (!stats) return null;
  const peak = Math.max(1, ...years.map((y) => y.n));
  return (
    <section className="v2-globe-stats" style={{ right }} aria-label="Travel stats">
      <dl className="v2-globe-stats-row">
        <div><dt>Countries</dt><dd>{fmt(stats.countries)}</dd></div>
        <div><dt>Miles flown</dt><dd>{fmt(kmToMi(stats.flownKm))}</dd></div>
      </dl>
      {years.length > 0 && (
        <div className="v2-globe-stats-years">
          <p className="v2-globe-stats-k">Trips per year</p>
          <ul>
            {years.map((y) => (
              <li key={y.year} aria-label={`${y.year}: ${y.n} ${y.n === 1 ? "trip" : "trips"}`}>
                <span className="bar" style={{ height: `${Math.max(3, Math.round((y.n / peak) * 28))}px` }} />
                <span className="n">{y.n}</span>
                <span className="y">{String(y.year).slice(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
