"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase/client";
import { formatPinDate, sortPinsByStartDate } from "../lib/pins/format";
import WorldMap from "./WorldMap";

export default function MapCanvas() {
  // React States
  const [loadingProgress, setLoadingProgress] = useState(10);
  const [loadingLog, setLoadingLog] = useState("CONNECTING TO WORLD GEOMETRY ATLAS...");
  const [isLoaded, setIsLoaded] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [statesData, setStatesData] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pins, setPins] = useState([]);
  const [newPinName, setNewPinName] = useState("");
  const [newPinCity, setNewPinCity] = useState("");
  const [newPinDetails, setNewPinDetails] = useState("");
  const [newPinStartDate, setNewPinStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [newPinEndDate, setNewPinEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [newLogTitle, setNewLogTitle] = useState("");
  const [newLogContent, setNewLogContent] = useState("");
  const [newLogCategory, setNewLogCategory] = useState("Experience");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Inline edit states for updating an existing pin and its logs
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [editPin, setEditPin] = useState({ title: "", location_name: "", start_date: "", end_date: "", latitude: 0, longitude: 0 });
  const [editingLogId, setEditingLogId] = useState(null);
  const [editLog, setEditLog] = useState({ title: "", content: "", category: "Experience", log_date: "" });
  
  // Auth States
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFlightPaths, setShowFlightPaths] = useState(false);
  const [activeTab, setActiveTab] = useState("Interactive Map");

  // Interactive HUD States
  const [hoveredCountry, setHoveredCountry] = useState("Hover over map");
  const [clickedCoords, setClickedCoords] = useState({ lat: 0, lon: 0 });
  const [activePin, setActivePin] = useState(null);
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [flyTo, setFlyTo] = useState(null);
  const [clusterPins, setClusterPins] = useState(null); // pins of a clicked cluster (filtered panel list)

  // React refs

  const activePinRef = useRef(activePin);
  const isAddingEntryRef = useRef(isAddingEntry);
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    activePinRef.current = activePin;
  }, [activePin]);

  useEffect(() => {
    isAddingEntryRef.current = isAddingEntry;
  }, [isAddingEntry]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Close the Travel Journals panel and reset the nav to Interactive Map
  const closeJournalPanel = () => {
    setActiveTab("Interactive Map");
    setActivePin(null);
    setClusterPins(null);
    setIsAddingEntry(false);
    setIsConfirmingDelete(false);
    setIsAddingLog(false);
    setIsEditingPin(false);
    setEditingLogId(null);
  };

  // --- WorldMap callbacks ---
  const handlePinClick = (pin) => {
    setFlyTo({ lat: pin.latitude, lon: pin.longitude });
    setActivePin(pin);
    setClusterPins(null);
    setActiveTab("Travel Journals");
    setIsAddingLog(false);
    setIsAddingEntry(false);
    setIsConfirmingDelete(false);
  };

  // Clicking a grouped pin opens the panel listing that group's locations.
  const handleClusterClick = (pinsArr) => {
    setClusterPins(pinsArr);
    setActivePin(null);
    setIsAddingEntry(false);
    setIsAddingLog(false);
    setIsConfirmingDelete(false);
    setActiveTab("Travel Journals");
  };

  // Clicking the map closes the panel when open; clicking land (when closed)
  // starts a new memory at that spot; clicking open ocean does nothing.
  const handleMapClick = ({ lat, lon, isLand }) => {
    if (activeTab === "Travel Journals") {
      closeJournalPanel();
      return;
    }
    if (isLand) {
      setClickedCoords({ lat: parseFloat(lat.toFixed(4)), lon: parseFloat(lon.toFixed(4)) });
      setActiveTab("Travel Journals");
      setIsAddingEntry(true);
    }
  };

  const handleHoverRegion = (name) => {
    setHoveredCountry(name || "Hover over map");
  };

  // Reset inline edit modes whenever the active pin changes
  useEffect(() => {
    setIsEditingPin(false);
    setEditingLogId(null);
  }, [activePin?.id]);


  // 1. Fetch GeoJSON Data on Mount
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

  // 2. Initialize Three.js World Map
  // Fetch pins from Supabase
  useEffect(() => {
    if (!session) return;
    const loadPins = async () => {
      const { data, error } = await supabase.from('pins').select('*, pin_logs(*)');
      if (error) {
        console.error("Failed to load pins from Supabase", error);
      } else if (data) {
        const mappedPins = data.map(pin => ({
          ...pin,
          logs: pin.pin_logs || []
        }));
        setPins(mappedPins);
      }
    };
    loadPins();
  }, [session]);


  // ----------------------------------------------------
  // DYNAMIC PIN MANAGEMENT
  // ----------------------------------------------------
  const handleAddPin = async () => {
    if (!newPinName || !newPinCity) return; // Basic validation
    const lat = parseFloat(clickedCoords.lat);
    const lon = parseFloat(clickedCoords.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      alert("Latitude must be between -90 and 90, and longitude between -180 and 180.");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      alert("You must be logged in to add a pin.");
      return;
    }

    try {
      const { data: insertedPin, error: pinError } = await supabase.from('pins').insert({
        user_id: userData.user.id,
        title: newPinName,
        location_name: newPinCity,
        latitude: lat,
        longitude: lon,
        start_date: newPinStartDate,
        end_date: newPinEndDate,
        trip_type: "Unknown",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).select().single();

      if (pinError) throw pinError;

      const { data: insertedLog, error: logError } = await supabase.from('pin_logs').insert({
        pin_id: insertedPin.id,
        log_date: newPinStartDate,
        title: "Initial Entry",
        content: newPinDetails,
        category: "Experience",
        media_urls: [],
        created_at: new Date().toISOString()
      }).select().single();

      if (logError) throw logError;

      const addedPin = { ...insertedPin, logs: [insertedLog] };

      setPins((prev) => [...prev, addedPin]);
      setIsAddingEntry(false);
      setActivePin(addedPin);
      setNewPinName("");
      setNewPinCity("");
      setNewPinDetails("");
      setNewPinStartDate(new Date().toISOString().split("T")[0]);
      setNewPinEndDate(new Date().toISOString().split("T")[0]);

    } catch (err) {
      console.error(err);
      alert("Error adding pin.");
    }
  };

  const handleAddLog = async () => {
    if (!activePin || !newLogTitle || !newLogContent) return;
    try {
      const { data: insertedLog, error } = await supabase.from('pin_logs').insert({
        pin_id: activePin.id,
        log_date: new Date().toISOString().split("T")[0],
        title: newLogTitle,
        content: newLogContent,
        category: newLogCategory,
        media_urls: [],
        created_at: new Date().toISOString()
      }).select().single();

      if (error) throw error;
      
      const updatedLogs = [...(activePin.logs || []), insertedLog];
      const savedPin = { ...activePin, logs: updatedLogs };
      
      setPins((prev) => prev.map(p => p.id === savedPin.id ? savedPin : p));
      setActivePin(savedPin);

      setIsAddingLog(false);
      setNewLogTitle("");
      setNewLogContent("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemovePin = async () => {
    if (!activePin) return;

    try {
      const { error } = await supabase.from('pins').delete().eq('id', activePin.id);
      if (error) throw error;

      // Remove from state
      setPins((prev) => prev.filter((p) => p.id !== activePin.id));
      setActivePin(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Helper: merge an updated pin into every place it's tracked (list, active card, journal view)
  const applyPinUpdate = (savedPin) => {
    setPins((prev) => prev.map((p) => (p.id === savedPin.id ? savedPin : p)));
    setActivePin((prev) => (prev && prev.id === savedPin.id ? savedPin : prev));
  };

  const startEditingPin = () => {
    if (!activePin) return;
    setEditPin({
      title: activePin.title || "",
      location_name: activePin.location_name || "",
      start_date: activePin.start_date || "",
      end_date: activePin.end_date || "",
      latitude: activePin.latitude ?? 0,
      longitude: activePin.longitude ?? 0,
    });
    setEditingLogId(null);
    setIsAddingLog(false);
    setIsEditingPin(true);
  };

  const handleUpdatePin = async () => {
    if (!activePin) return;
    if (!editPin.title || !editPin.location_name) {
      alert("Title and location are required.");
      return;
    }
    const lat = parseFloat(editPin.latitude);
    const lon = parseFloat(editPin.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      alert("Latitude must be between -90 and 90, and longitude between -180 and 180.");
      return;
    }
    try {
      const { data: updatedPin, error } = await supabase.from('pins').update({
        title: editPin.title,
        location_name: editPin.location_name,
        start_date: editPin.start_date || null,
        end_date: editPin.end_date || null,
        latitude: lat,
        longitude: lon,
        updated_at: new Date().toISOString(),
      }).eq('id', activePin.id).select().single();

      if (error) throw error;

      applyPinUpdate({ ...activePin, ...updatedPin, logs: activePin.logs || [] });
      setIsEditingPin(false);
    } catch (err) {
      console.error(err);
      alert("Error updating pin. (Make sure your Supabase 'pins' table has an UPDATE policy enabled.)");
    }
  };

  const startEditingLog = (log) => {
    setEditLog({
      title: log.title || "",
      content: log.content || "",
      category: log.category || "Experience",
      log_date: log.log_date || "",
    });
    setIsAddingLog(false);
    setEditingLogId(log.id);
  };

  const handleUpdateLog = async () => {
    if (!activePin || !editingLogId) return;
    if (!editLog.title || !editLog.content) {
      alert("Log title and details are required.");
      return;
    }
    try {
      const { data: updatedLog, error } = await supabase.from('pin_logs').update({
        title: editLog.title,
        content: editLog.content,
        category: editLog.category,
        log_date: editLog.log_date || null,
      }).eq('id', editingLogId).select().single();

      if (error) throw error;

      const updatedLogs = (activePin.logs || []).map((l) => (l.id === editingLogId ? { ...l, ...updatedLog } : l));
      applyPinUpdate({ ...activePin, logs: updatedLogs });
      setEditingLogId(null);
    } catch (err) {
      console.error(err);
      alert("Error updating log. (Make sure your Supabase 'pin_logs' table has an UPDATE policy enabled.)");
    }
  };

  const handleDeleteLog = async (logId) => {
    if (!activePin) return;
    try {
      const { error } = await supabase.from('pin_logs').delete().eq('id', logId);
      if (error) throw error;

      const updatedLogs = (activePin.logs || []).filter((l) => l.id !== logId);
      applyPinUpdate({ ...activePin, logs: updatedLogs });
      if (editingLogId === logId) setEditingLogId(null);
    } catch (err) {
      console.error(err);
      alert("Error deleting log.");
    }
  };

  const handleMigrateData = async () => {
    try {
      const res = await fetch('/api/pins');
      const localPins = await res.json();
      if (!localPins || localPins.length === 0) {
        alert("No local pins found to migrate!");
        return;
      }
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      for (const pin of localPins) {
        const { data: insertedPin, error: pinError } = await supabase.from('pins').insert({
          user_id: userData.user.id,
          title: pin.title,
          location_name: pin.location_name,
          latitude: pin.latitude,
          longitude: pin.longitude,
          start_date: pin.start_date,
          end_date: pin.end_date,
          trip_type: pin.trip_type,
          created_at: pin.created_at || new Date().toISOString(),
          updated_at: pin.updated_at || new Date().toISOString()
        }).select().single();

        if (pinError) { console.error(pinError); continue; }

        if (pin.logs && pin.logs.length > 0) {
          const logsToInsert = pin.logs.map(log => ({
            pin_id: insertedPin.id,
            log_date: log.log_date,
            title: log.title,
            content: log.content,
            category: log.category,
            media_urls: log.media_urls || [],
            created_at: log.created_at || new Date().toISOString()
          }));
          await supabase.from('pin_logs').insert(logsToInsert);
        }
      }
      alert("Migration complete! Refreshing map data...");
      const { data, error } = await supabase.from('pins').select('*, pin_logs(*)');
      if (!error && data) {
        setPins(data.map(p => ({ ...p, logs: p.pin_logs || [] })));
      }
    } catch (e) {
      console.error(e);
      alert("Migration failed.");
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) alert(error.message);
      else alert("Check your email for the login link!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) alert(error.message);
    }
    setAuthLoading(false);
  };

  return (
    <div className="app-container">
      {/* Auth Overlay */}
      {authLoading ? (
        <div style={{ position: "absolute", zIndex: 9999, width: "100vw", height: "100vh", background: "#0f172a" }} />
      ) : !session ? (
        <div style={{ position: "absolute", zIndex: 9999, width: "100vw", height: "100vh", background: "rgba(15, 23, 42, 0.8)", display: "flex", justifyContent: "center", alignItems: "center", color: "#fff", fontFamily: "sans-serif", backdropFilter: "blur(5px)" }}>
          <div style={{ background: "rgba(255,255,255,0.1)", padding: "2rem", borderRadius: "12px", width: "300px", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 4px 30px rgba(0,0,0,0.1)" }}>
            <h2 style={{ textAlign: "center", marginBottom: "1.5rem" }}>{isSignUp ? "Create Account" : "Login"}</h2>
            <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input type="email" placeholder="Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={{ padding: "0.75rem", borderRadius: "6px", border: "none", background: "rgba(255,255,255,0.8)", color: "#000" }} />
              <input type="password" placeholder="Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} style={{ padding: "0.75rem", borderRadius: "6px", border: "none", background: "rgba(255,255,255,0.8)", color: "#000" }} />
              <button type="submit" disabled={authLoading} style={{ background: "var(--accent)", color: "white", padding: "0.75rem", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
                {authLoading ? "Loading..." : (isSignUp ? "Sign Up" : "Login")}
              </button>
            </form>
            <div style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.8rem" }}>
              <button onClick={() => setIsSignUp(!isSignUp)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}>
                {isSignUp ? "Already have an account? Login" : "Need an account? Sign Up"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {/* 1. Animated Pastel Gradient Loader Overlay */}
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

      {/* 2. Flat 2D world map (D3-geo SVG) */}
      <div className="canvas-container">
        {isLoaded && geoJsonData && (
          <WorldMap
            geoJson={geoJsonData}
            statesGeoJson={statesData}
            pins={pins}
            activePinId={activePin?.id || null}
            showPaths={showFlightPaths && !activePin}
            flyTo={flyTo}
            onPinClick={handlePinClick}
            onMapClick={handleMapClick}
            onHoverRegion={handleHoverRegion}
            onClusterClick={handleClusterClick}
          />
        )}
      </div>

      {/* --- UI Layer Overlay --- */}
      <div className="ui-layer">
        
        {/* Top Left */}
        <div className="top-left-group">
          <div className="glass-base icon-button hamburger-container">
            <div className="hamburger-icon">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>

        {/* Top Center */}
        <div className="top-center-group">
          <div className="glass-base glass-pill nav-bar" style={{ position: "relative" }}>
            <div 
              className="nav-active-pill"
              style={{
                position: "absolute",
                top: "4px",
                bottom: "4px",
                width: "145px",
                left: activeTab === "Interactive Map" ? "4px" : activeTab === "Travel Journals" ? "152px" : "302px",
                background: "rgba(255, 255, 255, 0.15)",
                borderRadius: "20px",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                zIndex: 0
              }}
            />
            <div 
              className={`nav-item ${activeTab === "Interactive Map" ? "active" : ""}`}
              onClick={() => setActiveTab("Interactive Map")}
              style={{ cursor: "pointer", position: "relative", zIndex: 1, background: "transparent" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
              Interactive Map
            </div>
            <div 
              className={`nav-item ${activeTab === "Travel Journals" ? "active" : ""}`}
              onClick={() => { setClusterPins(null); setActivePin(null); setActiveTab("Travel Journals"); }}
              style={{ cursor: "pointer", position: "relative", zIndex: 1, background: "transparent" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              Travel Journals
            </div>
            <div className="nav-item" style={{ position: "relative", zIndex: 1, background: "transparent" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              Memory Gallery
            </div>
            <div className="nav-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              AI Trip Planner
            </div>
          </div>
          
          <div className="glass-base glass-pill exploring-badge-pill">
            <span className="label">EXPLORING REGION</span>
            <span className="value">{hoveredCountry || "World"}</span>
          </div>
        </div>

        {/* Travel Journals Sidebar */}
        {session && (
          <div className="glass-base" style={{
            position: "absolute",
            top: "0px",
            right: "0px",
            width: "350px",
            bottom: "0px",
            display: "flex",
            flexDirection: "column",
            padding: "1rem",
            zIndex: 100,
            overflow: "hidden",
            gap: "1rem",
            backdropFilter: "blur(20px)",
            borderRadius: "0px",
            borderRight: "none",
            borderBottom: "none",
            borderTop: "none",
            background: "rgba(255, 255, 255, 0.85)",
            boxShadow: "-12px 0 40px rgba(0,0,0,0.18)",
            transform: activeTab === "Travel Journals" ? "translateX(0)" : "translateX(100%)",
            transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
            pointerEvents: activeTab === "Travel Journals" ? "auto" : "none"
          }}>
            {isAddingEntry ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <h2 style={{ fontSize: "1.25rem", margin: "0 0 1rem 0", fontWeight: 700, color: "#111827", flexShrink: 0 }}>New Memory Point</h2>
                <div className="sidebar-scrollbar" style={{ overflowY: "auto", paddingRight: "0.5rem", flexGrow: 1 }}>
                  <label className="panel-label">Title</label>
                  <input type="text" placeholder="Title (e.g. Skiing)" className="panel-input" value={newPinName} onChange={(e) => setNewPinName(e.target.value)} />
                  <label className="panel-label">Location</label>
                  <input type="text" placeholder="Location (e.g. Alps)" className="panel-input" value={newPinCity} onChange={(e) => setNewPinCity(e.target.value)} />
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <div style={{ flex: 1 }}>
                      <label className="panel-label">Start Date</label>
                      <input type="date" className="panel-input" value={newPinStartDate} onChange={(e) => setNewPinStartDate(e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="panel-label">End Date</label>
                      <input type="date" className="panel-input" value={newPinEndDate} onChange={(e) => setNewPinEndDate(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <div style={{ flex: 1 }}>
                      <label className="panel-label">Latitude</label>
                      <input type="number" step="0.0001" className="panel-input" value={clickedCoords.lat} onChange={(e) => setClickedCoords({ ...clickedCoords, lat: e.target.value })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="panel-label">Longitude</label>
                      <input type="number" step="0.0001" className="panel-input" value={clickedCoords.lon} onChange={(e) => setClickedCoords({ ...clickedCoords, lon: e.target.value })} />
                    </div>
                  </div>
                  <label className="panel-label">Initial Log</label>
                  <textarea placeholder="Initial log entry details..." className="panel-textarea" value={newPinDetails} onChange={(e) => setNewPinDetails(e.target.value)} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexShrink: 0 }}>
                  <button className="glass-pill btn-green" style={{ flex: 1, display: "flex", justifyContent: "center" }} onClick={handleAddPin}>ADD MEMORY</button>
                  <button className="glass-pill icon-button" style={{ flex: 1, background: "rgba(0,0,0,0.05)", border: "1px solid #ccc", padding: "0.5rem 1rem", fontSize: "0.7rem", fontWeight: 700, display: "flex", justifyContent: "center", color: "#374151" }} onClick={closeJournalPanel}>CANCEL</button>
                </div>
              </div>
            ) : activePin ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <button
                  onClick={() => { setActivePin(null); setIsEditingPin(false); setEditingLogId(null); setIsAddingLog(false); setIsConfirmingDelete(false); }}
                  style={{ background: "transparent", border: "none", color: "#4b5563", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0", cursor: "pointer", fontSize: "0.9rem", fontWeight: "600", marginBottom: "0.5rem", flexShrink: 0 }}
                  onMouseOver={(e) => e.currentTarget.style.color = "#111827"}
                  onMouseOut={(e) => e.currentTarget.style.color = "#4b5563"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"></path><polyline points="12 19 5 12 12 5"></polyline></svg>
                  Back to Journals
                </button>

                {isConfirmingDelete ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem 0" }}>
                    <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 700, color: "#111827" }}>Remove this memory?</h2>
                    <p style={{ fontSize: "0.9rem", color: "#4b5563", margin: 0, lineHeight: 1.5 }}>This will permanently remove &quot;{activePin.title}&quot; and all of its logs.</p>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="glass-pill icon-button" style={{ flex: 1, background: "rgba(0,0,0,0.05)", border: "1px solid #ccc", padding: "0.5rem 1rem", fontSize: "0.7rem", fontWeight: 700, display: "flex", justifyContent: "center", color: "#374151" }} onClick={() => setIsConfirmingDelete(false)}>CANCEL</button>
                      <button className="glass-pill btn-red" style={{ flex: 1, display: "flex", justifyContent: "center" }} onClick={handleRemovePin}>REMOVE</button>
                    </div>
                  </div>
                ) : isEditingPin ? (
                  <div className="sidebar-scrollbar" style={{ overflowY: "auto", paddingRight: "0.5rem", flexGrow: 1 }}>
                    <h3 style={{ fontSize: "0.85rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px", marginTop: 0, marginBottom: "1rem" }}>Edit Memory Point</h3>
                    <label className="panel-label">Title</label>
                    <input type="text" className="panel-input" value={editPin.title} onChange={(e) => setEditPin({ ...editPin, title: e.target.value })} />
                    <label className="panel-label">Location</label>
                    <input type="text" className="panel-input" value={editPin.location_name} onChange={(e) => setEditPin({ ...editPin, location_name: e.target.value })} />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <div style={{ flex: 1 }}>
                        <label className="panel-label">Start Date</label>
                        <input type="date" className="panel-input" value={editPin.start_date || ""} onChange={(e) => setEditPin({ ...editPin, start_date: e.target.value })} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="panel-label">End Date</label>
                        <input type="date" className="panel-input" value={editPin.end_date || ""} onChange={(e) => setEditPin({ ...editPin, end_date: e.target.value })} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <div style={{ flex: 1 }}>
                        <label className="panel-label">Latitude</label>
                        <input type="number" step="0.0001" className="panel-input" value={editPin.latitude} onChange={(e) => setEditPin({ ...editPin, latitude: e.target.value })} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="panel-label">Longitude</label>
                        <input type="number" step="0.0001" className="panel-input" value={editPin.longitude} onChange={(e) => setEditPin({ ...editPin, longitude: e.target.value })} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <button className="glass-pill btn-green" style={{ flex: 1, display: "flex", justifyContent: "center" }} onClick={handleUpdatePin}>SAVE</button>
                      <button className="glass-pill icon-button" style={{ flex: 1, background: "rgba(0,0,0,0.05)", border: "1px solid #ccc", padding: "0.5rem 1rem", fontSize: "0.7rem", fontWeight: 700, display: "flex", justifyContent: "center", color: "#374151" }} onClick={() => setIsEditingPin(false)}>CANCEL</button>
                    </div>
                  </div>
                ) : (
                  <div className="sidebar-scrollbar" style={{ overflowY: "auto", paddingRight: "0.5rem", flexGrow: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "0.25rem" }}>
                          {formatPinDate(activePin.start_date) || "Undated"}{activePin.end_date && activePin.end_date !== activePin.start_date ? ` – ${formatPinDate(activePin.end_date)}` : ""}
                        </div>
                        <h2 style={{ fontSize: "1.5rem", margin: "0 0 0.5rem 0", fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>{activePin.location_name}</h2>
                        <p style={{ fontSize: "0.95rem", color: "#374151", margin: "0 0 1rem 0", lineHeight: 1.4 }}>{activePin.title}</p>
                      </div>
                      <button title="Edit pin" onClick={startEditingPin} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", flexShrink: 0, padding: "0.25rem", display: "flex" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                    </div>

                    <h3 style={{ fontSize: "0.85rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "1px solid rgba(0,0,0,0.1)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>Log Entries</h3>

                    {(activePin.logs || []).map((log, idx) => (
                      editingLogId === log.id ? (
                        <div key={log.id || idx} style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem" }}>
                          <input type="text" placeholder="Log Title" className="panel-input" value={editLog.title} onChange={(e) => setEditLog({ ...editLog, title: e.target.value })} />
                          <textarea placeholder="Experience details..." className="panel-textarea" value={editLog.content} onChange={(e) => setEditLog({ ...editLog, content: e.target.value })} />
                          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <select value={editLog.category} onChange={(e) => setEditLog({ ...editLog, category: e.target.value })} style={{ flex: 1, padding: "0.4rem", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.15)", fontSize: "0.8rem", color: "#111827", background: "#fff" }}>
                              <option value="Experience">Experience</option>
                              <option value="Restaurant">Restaurant</option>
                              <option value="Lodging">Lodging</option>
                              <option value="Transit">Transit</option>
                            </select>
                            <input type="date" value={editLog.log_date || ""} onChange={(e) => setEditLog({ ...editLog, log_date: e.target.value })} style={{ flex: 1, padding: "0.4rem", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.15)", fontSize: "0.8rem", color: "#111827", background: "#fff" }} />
                          </div>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button className="glass-pill btn-green" style={{ flex: 1, padding: "0.4rem", fontSize: "0.7rem", display: "flex", justifyContent: "center" }} onClick={handleUpdateLog}>SAVE LOG</button>
                            <button className="glass-pill icon-button" style={{ flex: 1, padding: "0.4rem", fontSize: "0.7rem", background: "rgba(0,0,0,0.05)", color: "#374151", display: "flex", justifyContent: "center" }} onClick={() => setEditingLogId(null)}>CANCEL</button>
                          </div>
                        </div>
                      ) : (
                        <div key={log.id || idx} style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.05)", padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem", color: "#111827", marginBottom: "0.5rem" }}>
                            <span style={{ flex: 1 }}>{log.title}</span>
                            <span style={{ fontSize: "0.65rem", background: "rgba(0, 0, 0, 0.05)", color: "var(--muted)", padding: "0.2rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>{log.category}</span>
                            <button title="Edit log" onClick={() => startEditingLog(log)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", padding: 0, display: "flex" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button title="Delete log" onClick={() => handleDeleteLog(log.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", padding: 0, display: "flex" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          </div>
                          <p style={{ fontSize: "0.85rem", margin: 0, whiteSpace: "pre-wrap", color: "#374151", lineHeight: 1.6 }}>{log.content}</p>
                        </div>
                      )
                    ))}

                    {(activePin.logs || []).length === 0 && !isAddingLog && (
                      <div style={{ fontSize: "0.9rem", color: "#6b7280", fontStyle: "italic", textAlign: "center", padding: "1rem 0" }}>No logs recorded for this trip yet.</div>
                    )}

                    {isAddingLog ? (
                      <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem" }}>
                        <input type="text" placeholder="Log Title (e.g., Best Dinner)" className="panel-input" value={newLogTitle} onChange={(e) => setNewLogTitle(e.target.value)} />
                        <textarea placeholder="Experience details..." className="panel-textarea" value={newLogContent} onChange={(e) => setNewLogContent(e.target.value)} />
                        <select value={newLogCategory} onChange={(e) => setNewLogCategory(e.target.value)} style={{ width: "100%", padding: "0.4rem", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.15)", marginBottom: "0.5rem", fontSize: "0.8rem", color: "#111827", background: "#fff" }}>
                          <option value="Experience">Experience</option>
                          <option value="Restaurant">Restaurant</option>
                          <option value="Lodging">Lodging</option>
                          <option value="Transit">Transit</option>
                        </select>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button className="glass-pill btn-green" style={{ flex: 1, padding: "0.4rem", fontSize: "0.7rem", display: "flex", justifyContent: "center" }} onClick={handleAddLog}>SAVE LOG</button>
                          <button className="glass-pill icon-button" style={{ flex: 1, padding: "0.4rem", fontSize: "0.7rem", background: "rgba(0,0,0,0.05)", color: "#374151", display: "flex", justifyContent: "center" }} onClick={() => setIsAddingLog(false)}>CANCEL</button>
                        </div>
                      </div>
                    ) : (
                      <button className="glass-pill" style={{ width: "100%", background: "rgba(0,0,0,0.04)", border: "1px dashed #cbd5e1", color: "#475569", fontSize: "0.75rem", marginBottom: "1rem", padding: "0.5rem", cursor: "pointer" }} onClick={() => setIsAddingLog(true)}>+ ADD LOG ENTRY</button>
                    )}

                    <button className="glass-pill btn-red" style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: "0.5rem" }} onClick={() => setIsConfirmingDelete(true)}>REMOVE PIN</button>
                  </div>
                )}
              </div>
            ) : clusterPins ? (
              <>
                <button
                  onClick={() => setClusterPins(null)}
                  style={{ background: "transparent", border: "none", color: "#4b5563", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.25rem", flexShrink: 0 }}
                  onMouseOver={(e) => (e.currentTarget.style.color = "#111827")}
                  onMouseOut={(e) => (e.currentTarget.style.color = "#4b5563")}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"></path><polyline points="12 19 5 12 12 5"></polyline></svg>
                  All journals
                </button>
                <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 700, color: "#111827", flexShrink: 0 }}>
                  {clusterPins.length} Locations
                </h2>
                <p style={{ fontSize: "0.85rem", color: "#4b5563", margin: "0.25rem 0 0", flexShrink: 0 }}>
                  Grouped at this spot on the map.
                </p>
                <div className="sidebar-scrollbar" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem", overflowY: "auto", paddingRight: "0.5rem" }}>
                  {sortPinsByStartDate(clusterPins).map((pin) => (
                    <div
                      key={pin.id}
                      style={{ display: "flex", flexDirection: "column", padding: "1rem", cursor: "pointer", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)", background: "rgba(0,0,0,0.02)", transition: "all 0.2s ease" }}
                      onClick={() => {
                        setFlyTo({ lat: pin.latitude, lon: pin.longitude });
                        setActivePin(pin);
                        setIsAddingLog(false);
                        setIsAddingEntry(false);
                        setIsConfirmingDelete(false);
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {formatPinDate(pin.start_date) || "Undated"}
                      </div>
                      <div style={{ fontSize: "1.1rem", color: "#111827", fontWeight: 600, margin: "0.25rem 0" }}>
                        {pin.location_name}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#4b5563", lineHeight: 1.4 }}>
                        {pin.title}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                  Travel Journals
                </h2>
                <p style={{ fontSize: "0.85rem", color: "#4b5563", margin: 0, flexShrink: 0 }}>
                  Chronological history of your adventures.
                </p>

                <div className="sidebar-scrollbar" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem", overflowY: "auto", paddingRight: "0.5rem" }}>
                  {sortPinsByStartDate(pins).map((pin, index) => (
                    <div 
                      key={pin.id} 
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        padding: "1rem",
                        cursor: "pointer",
                        borderRadius: "8px",
                        border: "1px solid rgba(0,0,0,0.05)",
                        background: "rgba(0,0,0,0.02)",
                        transition: "all 0.2s ease"
                      }}
                      onClick={() => {
                        setFlyTo({ lat: pin.latitude, lon: pin.longitude });
                        setActivePin(pin);
                        setIsAddingLog(false);
                        setIsAddingEntry(false);
                        setIsConfirmingDelete(false);
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {formatPinDate(pin.start_date) || "Undated"}
                      </div>
                      <div style={{ fontSize: "1.1rem", color: "#111827", fontWeight: 600, margin: "0.25rem 0" }}>
                        {pin.location_name}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#4b5563", lineHeight: 1.4 }}>
                        {pin.title}
                      </div>
                    </div>
                  ))}
                  {pins.length === 0 && (
                    <div style={{ textAlign: "center", color: "#4b5563", fontSize: "0.9rem", padding: "2rem 0" }}>
                      No travel journals yet. Add a memory pin to the globe!
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Bottom Left */}
        <div className="bottom-left-group">
          {pins.length === 0 && (
            <button className="glass-pill btn-green" style={{ width: "200px" }} onClick={handleMigrateData}>
              MIGRATE OLD DATA
            </button>
          )}
          {showProfileMenu && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", width: "200px" }}>
              <button
                className="glass-pill"
                style={{fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.04em", width: "100%", background: showFlightPaths ? "rgba(226,96,63,0.12)" : "rgba(0,0,0,0.06)", border: showFlightPaths ? "1px solid rgba(226,96,63,0.35)" : "1px solid rgba(0,0,0,0.1)", color: showFlightPaths ? "var(--accent)" : "var(--ink)", cursor: "pointer", padding: "0.55rem", borderRadius: "8px"}}
                onClick={() => setShowFlightPaths(!showFlightPaths)}
              >
                {showFlightPaths ? "HIDE FLIGHT PATHS" : "SHOW FLIGHT PATHS"}
              </button>
              <button
                className="glass-pill"
                style={{fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.04em", width: "100%", background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.1)", color: "var(--ink)", cursor: "pointer", padding: "0.55rem", borderRadius: "8px"}}
                onClick={() => supabase.auth.signOut()}
              >
                SIGN OUT
              </button>
            </div>
          )}
          <div
            className="glass-base glass-pill profile-widget"
            style={{ cursor: "pointer" }}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <div className="profile-avatar">👨‍🚀</div>
            <div className="profile-info">
              <span className="name">{session?.user?.email?.split('@')[0].toUpperCase() || "WANDERER"}</span>
              <span className="status">ONLINE</span>
            </div>
            <div className="status-dot"></div>
          </div>
        </div>

        {/* Bottom Right */}
        <div className="bottom-right-group">
          <button className="glass-base glass-pill icon-button btn-icon-right" onClick={() => {
                setClickedCoords({ lat: 40.7128, lon: -74.0060 });
                setActivePin(null);
                setActiveTab("Travel Journals");
                setIsAddingEntry(true);
              }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
            <span style={{fontSize: "0.8rem", fontWeight: "700", color: "#0f172a"}}>ADD ENTRY</span>
          </button>
        </div>
      </div>
    </div>
  );
}
