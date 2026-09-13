"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase/client";
import {
  addPin as insertPin,
  updatePin as updatePinRow,
  removePin as deletePinRow,
  addLog as insertPinLog,
  addLogs as insertPinLogs,
  updateLog as updatePinLogRow,
  removeLog as deletePinLogRow,
} from "../lib/pins/api";
import {
  createJourney as createJourneyRow,
  updateJourney as updateJourneyRow,
  softDeleteJourney as softDeleteJourneyRow,
  setJourneyVisibility as setJourneyVisibilityRow,
  movePinToJourney,
} from "../lib/journeys/api";
import { useAuthSession } from "../hooks/useAuthSession";
import { useTravelData } from "../hooks/useTravelData";
import AuthGate from "./shell/AuthGate";
import AppShell from "./shell/AppShell";
import JournalsPanel from "./journals/JournalsPanel";
import WorldMap from "./WorldMap";
import MapLoader from "./map/MapLoader";

/**
 * Thin composer: hooks + AuthGate + MapLoader + WorldMap + AppShell + JournalsPanel.
 * PR7 final MapCanvas split step — shell chrome and pin load extracted; pin CRUD
 * and journal interaction state remain here (tightly coupled; leave for Journey props later).
 */
export default function MapCanvas() {
  // React States
  // GeoJSON + loader progress live in MapLoader
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // unused chrome leftover; leave for behavior identity
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
    authBusy,
    authError,
    magicLinkSent,
    handleAuth,
    handleMagicLink,
    handleGoogle,
  } = useAuthSession();

  // Journeys + flat pins (WorldMap) — useTravelData
  const { journeys, pins, setPins, reload: reloadTravelData } = useTravelData(session);

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
  const [activeJourneyId, setActiveJourneyId] = useState(null); // journey drill-in for JournalsPanel

  const activeJourney =
    activeJourneyId != null
      ? journeys.find((j) => j.id === activeJourneyId) || null
      : null;

  const resolveJourneyIdForPin = (pin) => {
    if (pin?.journey_id) return pin.journey_id;
    const imported = journeys.find((j) => j.title === "Imported");
    return imported?.id ?? "__client_imported__";
  };

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
    setActiveJourneyId(null);
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
    setActiveJourneyId(resolveJourneyIdForPin(pin));
    setActiveTab("Travel Journals");
    setIsAddingLog(false);
    setIsAddingEntry(false);
    setIsConfirmingDelete(false);
  };

  // Clicking a grouped pin opens the panel listing that group's locations.
  const handleClusterClick = (pinsArr) => {
    setClusterPins(pinsArr);
    setActivePin(null);
    setActiveJourneyId(null);
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

  // ----------------------------------------------------
  // DYNAMIC PIN MANAGEMENT (CRUD stays here — coupled to form/HUD state)
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
      // If drilled into a real journey, attach the new pin; otherwise omit
      // journey_id and let the Harbor Imported default trigger assign it.
      const pinFields = {
        user_id: userData.user.id,
        title: newPinName,
        location_name: newPinCity,
        latitude: lat,
        longitude: lon,
        start_date: newPinStartDate,
        end_date: newPinEndDate,
        trip_type: "Unknown",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (activeJourneyId && !String(activeJourneyId).startsWith("__")) {
        pinFields.journey_id = activeJourneyId;
      }

      const { data: insertedPin, error: pinError } = await insertPin(pinFields);

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

  // --- Journey write path ---
  const handleCreateJourney = async (form) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      alert("You must be logged in to create a journey.");
      return false;
    }
    try {
      const { data, error } = await createJourneyRow({
        userId: userData.user.id,
        title: form.title,
        summary: form.summary,
        date_start: form.date_start || null,
        date_end: form.date_end || null,
        tags: form.tags,
      });
      if (error) throw error;
      await reloadTravelData();
      if (data?.id) setActiveJourneyId(data.id);
      return true;
    } catch (err) {
      console.error(err);
      alert(err.message || "Error creating journey.");
      return false;
    }
  };

  const handleUpdateJourney = async (id, form) => {
    try {
      const fields = {};
      if (form.title !== undefined) fields.title = form.title;
      if (form.summary !== undefined) fields.summary = form.summary;
      if (form.date_start !== undefined) fields.date_start = form.date_start || null;
      if (form.date_end !== undefined) fields.date_end = form.date_end || null;
      if (form.tags !== undefined) fields.tags = form.tags;
      if (form.visibility !== undefined) fields.visibility = form.visibility;
      if (form.share_token !== undefined) fields.share_token = form.share_token;
      // Ensure share_token when saving as unlisted without one (DB default usually already set).
      if (fields.visibility === "unlisted" && !fields.share_token) {
        const current = journeys.find((j) => j.id === id);
        if (!current?.share_token && typeof crypto !== "undefined" && crypto.randomUUID) {
          fields.share_token = crypto.randomUUID();
        }
      }
      const { error } = await updateJourneyRow(id, fields);
      if (error) throw error;
      await reloadTravelData();
      return true;
    } catch (err) {
      console.error(err);
      alert(err.message || "Error updating journey.");
      return false;
    }
  };

  const handleSetVisibility = async (journey, visibility) => {
    if (!journey?.id) return false;
    try {
      const { error } = await setJourneyVisibilityRow(
        journey.id,
        visibility,
        journey.share_token || null
      );
      if (error) throw error;
      await reloadTravelData();
      return true;
    } catch (err) {
      console.error(err);
      alert(err.message || "Error updating visibility.");
      return false;
    }
  };

  const handleSoftDeleteJourney = async (journey) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      alert("You must be logged in to delete a journey.");
      return false;
    }
    try {
      const { error } = await softDeleteJourneyRow(journey, userData.user.id);
      if (error) throw error;
      if (activeJourneyId === journey.id) setActiveJourneyId(null);
      await reloadTravelData();
      return true;
    } catch (err) {
      console.error(err);
      alert(err.message || "Error deleting journey.");
      return false;
    }
  };

  const handleMovePlace = async (pin, targetJourneyId) => {
    try {
      const { data, error } = await movePinToJourney(pin.id, targetJourneyId);
      if (error) throw error;
      const saved = { ...pin, ...data, logs: pin.logs || [] };
      setPins((prev) => prev.map((p) => (p.id === pin.id ? saved : p)));
      if (activePin?.id === pin.id) setActivePin(saved);
      await reloadTravelData();
      return true;
    } catch (err) {
      console.error(err);
      alert(err.message || "Error moving place.");
      return false;
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
      await reloadTravelData();
    } catch (e) {
      console.error(e);
      alert("Migration failed.");
    }
  };

  return (
    <div className="app-container">
      <AuthGate
        authLoading={authLoading}
        authBusy={authBusy}
        session={session}
        isSignUp={isSignUp}
        setIsSignUp={setIsSignUp}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        authError={authError}
        magicLinkSent={magicLinkSent}
        handleAuth={handleAuth}
        handleMagicLink={handleMagicLink}
        handleGoogle={handleGoogle}
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

      <AppShell
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hoveredCountry={hoveredCountry}
        pinsLength={pins.length}
        showProfileMenu={showProfileMenu}
        setShowProfileMenu={setShowProfileMenu}
        showFlightPaths={showFlightPaths}
        setShowFlightPaths={setShowFlightPaths}
        sessionEmail={session?.user?.email}
        onSignOut={() => supabase.auth.signOut()}
        onMigrateData={handleMigrateData}
        onAddEntry={() => {
          setClickedCoords({ lat: 40.7128, lon: -74.0060 });
          setActivePin(null);
          setActiveTab("Travel Journals");
          setIsAddingEntry(true);
        }}
        onOpenJournalsTab={() => { setClusterPins(null); setActivePin(null); setActiveJourneyId(null); setActiveTab("Travel Journals"); }}
      >
        {session && (
          <JournalsPanel
            activeTab={activeTab}
            isAddingEntry={isAddingEntry}
            activePin={activePin}
            activeJourney={activeJourney}
            clusterPins={clusterPins}
            journeys={journeys}
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
            onSelectJourney={(journey) => {
              setActiveJourneyId(journey.id);
              setClusterPins(null);
              setActivePin(null);
            }}
            onBackFromJourney={() => setActiveJourneyId(null)}
            onBackFromCluster={() => setClusterPins(null)}
            onCreateJourney={handleCreateJourney}
            onUpdateJourney={handleUpdateJourney}
            onSoftDeleteJourney={handleSoftDeleteJourney}
            onSetVisibility={handleSetVisibility}
            onMovePlace={handleMovePlace}
          />
        )}
      </AppShell>
          </>
        )}
      </MapLoader>
    </div>
  );
}
