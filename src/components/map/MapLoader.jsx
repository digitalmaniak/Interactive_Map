"use client";

import { useEffect, useState } from "react";

/**
 * GeoJSON fetch (countries + US states) + animated loading progress overlay.
 * Owns loader state; exposes { isLoaded, geoJsonData, statesData } via children render prop.
 * Behavior-identical extract from MapCanvas — no WorldMap changes.
 */
export default function MapLoader({ children }) {
  const [loadingProgress, setLoadingProgress] = useState(10);
  const [loadingLog, setLoadingLog] = useState("CONNECTING TO WORLD GEOMETRY ATLAS...");
  const [isLoaded, setIsLoaded] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [statesData, setStatesData] = useState(null);

  // Fetch GeoJSON Data on Mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    let isDataFetched = false;
    let progress = 10;

    const timer = setInterval(() => {
      progress += Math.floor(Math.random() * 5) + 2;
      if (progress >= 50 && !isDataFetched) {
        progress = 50; // Pause at 50% until data is fetched
      }
      if (progress > 95) {
        progress = 95;
      }
      setLoadingProgress(progress);
    }, 150);

    Promise.all([
      fetch("/data/countries.json").then((res) => {
        if (!res.ok) throw new Error("Failed to fetch countries GeoJSON");
        return res.json();
      }),
      fetch("/data/us-states.json").then((res) => {
        if (!res.ok) throw new Error("Failed to fetch US states GeoJSON");
        return res.json();
      })
    ])
      .then(([countries, states]) => {
        isDataFetched = true;
        setGeoJsonData(countries);
        setStatesData(states);
        setLoadingLog("PARSING WORLD BOUNDARIES...");
        
        // Finish progress
        clearInterval(timer);
        let finalProgress = Math.max(50, progress);
        const finalTimer = setInterval(() => {
          finalProgress += 10;
          setLoadingProgress(Math.min(100, finalProgress));
          if (finalProgress >= 100) {
            clearInterval(finalTimer);
            setLoadingLog("ATLAS READY.");
            setTimeout(() => setIsLoaded(true), 600);
          }
        }, 80);
      })
      .catch((err) => {
        console.error(err);
        isDataFetched = true;
        setLoadingLog("ERROR LOADING WORLD DATA. USING FALLBACK.");
        clearInterval(timer);
        setLoadingProgress(100);
        setTimeout(() => setIsLoaded(true), 1000);
      });

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {/* Animated Pastel Gradient Loader Overlay */}
      <div className={`loader-overlay ${isLoaded ? "hidden" : ""}`}>
        <div className="loader-container">
          <div>
            <h2 className="loader-status-title">MY TRAVEL JOURNAL</h2>
          </div>

          <div className="horizontal-loader-bar">
            <div 
              className="horizontal-loader-fill" 
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          
          <div className="loader-status-text">
            {loadingLog} ({loadingProgress}%)
          </div>
        </div>
      </div>

      {typeof children === "function"
        ? children({ isLoaded, geoJsonData, statesData })
        : children}
    </>
  );
}
