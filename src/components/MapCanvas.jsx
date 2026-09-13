"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase/client";
import {
  loadPins as fetchPinsFromApi,
  addPin as insertPin,
  updatePin as updatePinRow,
  removePin as deletePinRow,
  addLog as insertPinLog,
  addLogs as insertPinLogs,
  updateLog as updatePinLogRow,
  removeLog as deletePinLogRow,
} from "../lib/pins/api";
import { useAuthSession } from "../hooks/useAuthSession";
import AuthGate from "./shell/AuthGate";
import JournalsPanel from "./journals/JournalsPanel";
import WorldMap from "./WorldMap";
import MapLoader from "./map/MapLoader";

export default function MapCanvas() {
  // React States
  // GeoJSON + loader progress live in MapLoader
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
  
  // Auth (session + login/signup) — extracted to useAuthSession + AuthGate
  const {
    session,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    isSignUp,
    setIsSignUp,
    authLoading,
    handleAuth,
  } = useAuthSession();
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


  // Select a pin from journal/cluster lists (fly + open detail)
  const handleSelectPinFromList = (pin) => {
    setFlyTo({ lat: pin.latitude, lon: pin.longitude });
    setActivePin(pin);
    setIsAddingLog(false);
    setIsAddingEntry(false);
    setIsConfirmingDelete(false);
  };

  const handleBackFromPin = () => {
    setActivePin(null);
    setIsEditingPin(false);
    setEditingLogId(null);
    setIsAddingLog(false);
    setIsConfirmingDelete(false);
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


  // Fetch pins from Supabase
  useEffect(() => {
    if (!session) return;
    const loadPins = async () => {
      const { data, error } = await fetchPinsFromApi();
      if (error) {
        console.error("Failed to load pins from Supabase", error);
      } else if (data) {
        setPins(data);
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
      const { data: insertedPin, error: pinError } = await insertPin({
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
      });

      if (pinError) throw pinError;

      const { data: insertedLog, error: logError } = await insertPinLog({
        pin_id: insertedPin.id,
        log_date: newPinStartDate,
        title: "Initial Entry",
        content: newPinDetails,
        category: "Experience",
        media_urls: [],
        created_at: new Date().toISOString()
      });

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
      const { data: insertedLog, error } = await insertPinLog({
        pin_id: activePin.id,
        log_date: new Date().toISOString().split("T")[0],
        title: newLogTitle,
        content: newLogContent,
        category: newLogCategory,
        media_urls: [],
        created_at: new Date().toISOString()
      });

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
      const { error } = await deletePinRow(activePin.id);
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
      const { data: updatedPin, error } = await updatePinRow(activePin.id, {
        title: editPin.title,
        location_name: editPin.location_name,
        start_date: editPin.start_date || null,
        end_date: editPin.end_date || null,
        latitude: lat,
        longitude: lon,
        updated_at: new Date().toISOString(),
      });

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
      const { data: updatedLog, error } = await updatePinLogRow(editingLogId, {
        title: editLog.title,
        content: editLog.content,
        category: editLog.category,
        log_date: editLog.log_date || null,
      });

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
      const { error } = await deletePinLogRow(logId);
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
        const { data: insertedPin, error: pinError } = await insertPin({
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
        });

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
          await insertPinLogs(logsToInsert);
        }
      }
      alert("Migration complete! Refreshing map data...");
      const { data, error } = await fetchPinsFromApi();
      if (!error && data) {
        setPins(data);
      }
    } catch (e) {
      console.error(e);
      alert("Migration failed.");
    }
  };

  return (
    <div className="app-container">
      <AuthGate
        authLoading={authLoading}
        session={session}
        isSignUp={isSignUp}
        setIsSignUp={setIsSignUp}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        handleAuth={handleAuth}
      />
      <MapLoader>
        {({ isLoaded, geoJsonData, statesData }) => (
          <>
      {/* Flat 2D world map (D3-geo SVG) — data from MapLoader */}
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

        {/* Travel Journals Sidebar — modes routed by JournalsPanel */}
        {session && (
          <JournalsPanel
            activeTab={activeTab}
            isAddingEntry={isAddingEntry}
            activePin={activePin}
            clusterPins={clusterPins}
            pins={pins}
            newPinName={newPinName}
            setNewPinName={setNewPinName}
            newPinCity={newPinCity}
            setNewPinCity={setNewPinCity}
            newPinStartDate={newPinStartDate}
            setNewPinStartDate={setNewPinStartDate}
            newPinEndDate={newPinEndDate}
            setNewPinEndDate={setNewPinEndDate}
            clickedCoords={clickedCoords}
            setClickedCoords={setClickedCoords}
            newPinDetails={newPinDetails}
            setNewPinDetails={setNewPinDetails}
            handleAddPin={handleAddPin}
            closeJournalPanel={closeJournalPanel}
            isConfirmingDelete={isConfirmingDelete}
            setIsConfirmingDelete={setIsConfirmingDelete}
            isEditingPin={isEditingPin}
            editPin={editPin}
            setEditPin={setEditPin}
            startEditingPin={startEditingPin}
            handleUpdatePin={handleUpdatePin}
            setIsEditingPin={setIsEditingPin}
            editingLogId={editingLogId}
            editLog={editLog}
            setEditLog={setEditLog}
            startEditingLog={startEditingLog}
            handleUpdateLog={handleUpdateLog}
            setEditingLogId={setEditingLogId}
            handleDeleteLog={handleDeleteLog}
            isAddingLog={isAddingLog}
            setIsAddingLog={setIsAddingLog}
            newLogTitle={newLogTitle}
            setNewLogTitle={setNewLogTitle}
            newLogContent={newLogContent}
            setNewLogContent={setNewLogContent}
            newLogCategory={newLogCategory}
            setNewLogCategory={setNewLogCategory}
            handleAddLog={handleAddLog}
            handleRemovePin={handleRemovePin}
            onBackFromPin={handleBackFromPin}
            onSelectPin={handleSelectPinFromList}
            onBackFromCluster={() => setClusterPins(null)}
          />
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
          </>
        )}
      </MapLoader>
    </div>
  );
}
