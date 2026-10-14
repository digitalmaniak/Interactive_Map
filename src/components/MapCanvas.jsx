"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase/client";
import {
  addPin as insertPin,
  updatePin as updatePinRow,
  removePin as deletePinRow,
  addLog as insertPinLog,
  updateLog as updatePinLogRow,
  removeLog as deletePinLogRow,
} from "../lib/pins/api";
import {
  createJourney as createJourneyRow,
  updateJourney as updateJourneyRow,
  softDeleteJourney as softDeleteJourneyRow,
  shareJourney as shareJourneyRow,
  stopSharingJourney as stopSharingJourneyRow,
  movePinToJourney,
} from "../lib/journeys/api";
import QuickAdd from "./quickadd/QuickAdd";
import { placeLine } from "../lib/geocode/quickAdd";
import { useAuthSession } from "../hooks/useAuthSession";
import { flyoverActive } from "./map/scene/flyover/flyoverState";
import { useTravelData } from "../hooks/useTravelData";
import { useMobileViewport, SHEET_HEADER_PX } from "../hooks/useMobileSheet";
import AuthGate from "./shell/AuthGate";
import AppShell from "./shell/AppShell";
import JournalsPanel from "./journals/JournalsPanel";
import { fetchTripRanges, fetchUndatedCount } from "../lib/timeline/api";
import GlobeScene from "./map/scene";
import MapLoader from "./map/MapLoader";
import TripDraft, { syncLegs } from "./draft/TripDraft";
import { emptyDraft, hasLocation } from "../lib/draft/draft";
import { parseTrip, saveDraft } from "../lib/draft/api";

// Trip draft kept in localStorage so leaving the page loses nothing.
const DRAFT_KEY = "odyssey.tripDraft.v1";
const readStoredDraft = () => {
  try {
    const v = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null");
    return v && v.draft && Array.isArray(v.draft.stops) ? v : null;
  } catch { return null; }
};

/**
 * Thin composer: hooks + AuthGate + MapLoader + GlobeScene (R3F) + AppShell + JournalsPanel.
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
  const [newPinCountryCode, setNewPinCountryCode] = useState(""); // set only by quick add
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

  // Journeys + flat pins (GlobeScene) — useTravelData
  const { journeys, pins, setPins, reload: reloadTravelData, journeysLoaded } = useTravelData(session);

  // ---- Trip draft (items 3 and 4) ----
  // face: null (closed), "start" (textarea card) or "edit" (guided build or typed preview).
  const [tripDraft, setTripDraftState] = useState(() => readStoredDraft() || { face: null, draft: emptyDraft(), text: "", playKey: null, stub: false });
  const setTripDraft = (fn) => setTripDraftState((cur) => {
    const next = typeof fn === "function" ? fn(cur) : fn;
    try {
      // Kept while it holds anything (open, or closed with stops or text); cleared on save or discard.
      if (next.face || next.draft?.stops?.length || next.text?.trim()) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(DRAFT_KEY);
    } catch { /* storage full or blocked: the draft still lives in memory */ }
    return next;
  });
  const [draftBusy, setDraftBusy] = useState({ parsing: false, saving: false, error: "", saveError: "" });
  const [dataVersion, setDataVersion] = useState(0);
  // New account: no trips (an empty Imported bucket does not count) and no pins.
  const accountEmpty = Boolean(session) && journeysLoaded && pins.length === 0 && journeys.every((j) => j.title === "Imported" && !(j.places || j.pins || []).length);
  const draftFace = tripDraft.face || (accountEmpty ? "start" : null);
  const openDraft = (face) => {
    setDraftBusy({ parsing: false, saving: false, error: "", saveError: "" });
    setTripDraft((cur) => ({ ...cur, face, draft: face === "edit" && !cur.draft?.stops?.length ? syncLegs(emptyDraft()) : cur.draft }));
  };
  const closeDraft = () => setTripDraft((cur) => ({ ...cur, face: null }));
  const discardDraft = () => setTripDraft({ face: null, draft: emptyDraft(), text: "", playKey: null, stub: false });
  const submitDraftText = async () => {
    const text = tripDraft.text.trim();
    if (!text || draftBusy.parsing) return;
    setDraftBusy((b) => ({ ...b, parsing: true, error: "" }));
    const r = await parseTrip(text).catch(() => ({ error: "parse_failed", message: "Could not read that trip. Try rephrasing, or build it step by step." }));
    if (r.error) { setDraftBusy((b) => ({ ...b, parsing: false, error: r.message })); return; }
    setDraftBusy((b) => ({ ...b, parsing: false, error: "" }));
    // Parsed items start as guesses (40% style) until the user touches them.
    const d = syncLegs({ ...r.draft, stops: r.draft.stops.map((st) => ({ ...st, guessed: true })), legs: r.draft.legs.map((l) => ({ ...l, guessed: true })) });
    setTripDraft((cur) => ({ ...cur, face: "edit", draft: d, stub: !!r.stub, playKey: Date.now() }));
    setActiveTab("Map");
  };
  const saveTripDraft = async () => {
    if (draftBusy.saving) return;
    setDraftBusy((b) => ({ ...b, saving: true, saveError: "" }));
    const r = await saveDraft(tripDraft.draft).catch((e) => ({ error: e?.message || "save_failed" }));
    if (r.error) { setDraftBusy((b) => ({ ...b, saving: false, saveError: "Could not save this trip. Please try again." })); return; }
    setDraftBusy((b) => ({ ...b, saving: false }));
    setTripDraft({ face: null, draft: emptyDraft(), text: "", playKey: null, stub: false });
    await reloadTravelData();
    setDataVersion((v) => v + 1);
    if (r.id) { setActiveJourneyId(r.id); setActiveTab("Journals"); }
  };
  // Globe data for the open draft: located stops become pins, consecutive located stops get legs.
  const draftOpen = tripDraft.face === "edit";
  const draftGlobe = (() => {
    if (!draftOpen) return null;
    const d = tripDraft.draft;
    const located = d.stops.map((st, i) => ({ st, i })).filter(({ st }) => hasLocation(st));
    const key = `draft:${located.length}:${tripDraft.playKey || 0}`;
    const dpins = located.map(({ st, i }) => ({ id: `draft:${i}`, journey_id: key, latitude: st.lat, longitude: st.lng, title: st.name, location_name: st.name, logs: [] }));
    const ok = new Set(located.map(({ i }) => i));
    const legs = d.legs.filter((l) => ok.has(l.from_stop) && ok.has(l.to_stop)).map((l, k) => ({
      id: `draftleg:${k}`, from_pin_id: `draft:${l.from_stop}`, to_pin_id: `draft:${l.to_stop}`, from_label: l.from_label, to_label: l.to_label,
      from_lat: null, from_lng: null, to_lat: null, to_lng: null, mode: l.mode || "other", status: l.guessed || !l.mode ? "draft" : "confirmed", sort_order: k, depart_at: null, arrive_at: null,
    }));
    return { key, pins: dpins, legs, title: d.journey.title || "New trip" };
  })();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFlightPaths, setShowFlightPaths] = useState(false);
  const [activeTab, setActiveTab] = useState("Map");

  // Interactive HUD States
  const [hoveredCountry, setHoveredCountry] = useState(null);
  // Null until the user picks a place (search pick or a land click). No default coordinates.
  const [clickedCoords, setClickedCoords] = useState(null);
  const [addSearchOpen, setAddSearchOpen] = useState(false); // Add entry: place search first
  const [activePin, setActivePin] = useState(null);
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [flyTo, setFlyTo] = useState(null);
  const [clusterPins, setClusterPins] = useState(null); // pins of a clicked cluster (filtered panel list)
  const [activeJourneyId, setActiveJourneyId] = useState(null); // journey drill-in for JournalsPanel

  const activeJourney =
    activeJourneyId != null
      ? journeys.find((j) => j.id === activeJourneyId) || null
      : null;
  // The Imported bucket (undated pins from anywhere) is a collection, not a trip: the
  // globe treats a pin opened from it as a single point selection.
  const activeJourneyIsCollection =
    activeJourneyId != null &&
    (String(activeJourneyId).startsWith("__") || activeJourney?.title === "Imported");

  const resolveJourneyIdForPin = (pin) => {
    if (pin?.journey_id) return pin.journey_id;
    const imported = journeys.find((j) => j.title === "Imported");
    return imported?.id ?? "__client_imported__";
  };

  // React refs

  // Timeline strip data: trip date ranges (journey_stats_v2) and the undated count
  // (data_review_items). Read only, once per session and when the panel closes or opens.
  const [tripRanges, setTripRanges] = useState([]);
  const [undatedCount, setUndatedCount] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  useEffect(() => {
    if (!session) return undefined;
    const ctl = new AbortController();
    fetchTripRanges(ctl.signal).then(({ rows, error }) => { if (!ctl.signal.aborted && !error) setTripRanges(rows); }).catch(() => {});
    fetchUndatedCount(ctl.signal).then(({ count, error }) => { if (!ctl.signal.aborted && !error) setUndatedCount(count); }).catch(() => {});
    return () => ctl.abort();
  }, [session, reviewOpen, dataVersion]);

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

  // Mobile bottom sheet (under 768 px): open whenever the journals panel is; swiping the
  // handle collapses it to its header. Reopening the panel always starts at 50%.
  const viewport = useMobileViewport();
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [sheetHeaderPx, setSheetHeaderPx] = useState(SHEET_HEADER_PX); // measured by the panel
  const panelIsOpen = Boolean(session) && activeTab === "Journals";
  const [sheetFor, setSheetFor] = useState(panelIsOpen);
  if (sheetFor !== panelIsOpen) { setSheetFor(panelIsOpen); if (panelIsOpen) setSheetCollapsed(false); }
  const sheetOpen = viewport.mobile && panelIsOpen;
  const sheetInset = sheetOpen ? (sheetCollapsed ? sheetHeaderPx : Math.round(viewport.h * 0.5)) : 0;

  const timelineProps = {
    // Stop dates first (journey_stats_v2 derives them from stops only), then the trip's own
    // journeys.date_start/date_end, else undated.
    trips: tripRanges.map((r) => {
      const j = (journeys || []).find((x) => x.id === r.journey_id);
      const first = r.first_date || j?.date_start || null;
      const last = r.first_date ? r.last_date : j?.date_end || j?.date_start || null;
      return { ...r, first_date: first, last_date: last, title: j?.title || "Journey" };
    }),
    undatedCount,
    onOpenTrip: (id) => { setClusterPins(null); setActivePin(null); setIsAddingEntry(false); setReviewOpen(false); setActiveJourneyId(id); setActiveTab("Journals"); },
    onOpenReview: () => { setClusterPins(null); setActivePin(null); setIsAddingEntry(false); setActiveJourneyId(null); setReviewOpen(true); setActiveTab("Journals"); },
  };

  // Close the Journals panel and reset the nav to Map
  const closeJournalPanel = () => {
    setActiveTab("Map");
    setReviewOpen(false);
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
    setActiveTab("Journals");
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
    setActiveTab("Journals");
  };

  // Clicking the map closes the panel when open; clicking land (when closed)
  // starts a new memory at that spot; clicking open ocean does nothing.
  const handleMapClick = ({ lat, lon, isLand, offGlobe }) => {
    if (tripDraft.face === "edit") return; // the draft card owns the globe while open
    // Empty globe, ocean or space while a trip is open (or the panel is open) exits to the map.
    if (activeTab === "Journals" || activeJourneyId != null || activePin) {
      closeJournalPanel();
      return;
    }
    if (offGlobe) return;
    if (isLand) {
      setClickedCoords({ lat: parseFloat(lat.toFixed(4)), lon: parseFloat(lon.toFixed(4)) });
      setNewPinCountryCode("");
      setActiveTab("Journals");
      setIsAddingEntry(true);
    }
  };

  // Esc closes the journal panel. While a flyover is active Esc belongs to the flyover
  // (it stops it), so this handler bails on the shared flag as well as on propagation.
  const escRef = useRef(null);
  useEffect(() => {
    escRef.current = () => {
      if (activeTab !== "Journals") return;
      // Inside a journal (or a place, cluster or the review screen): back to the journal
      // list. From the list itself (or the add form): close the panel as before.
      if (!isAddingEntry && (activeJourneyId != null || activePin || clusterPins || reviewOpen)) {
        setActivePin(null);
        setClusterPins(null);
        setReviewOpen(false);
        setActiveJourneyId(null);
        setIsConfirmingDelete(false);
        setIsEditingPin(false);
        setIsAddingLog(false);
        setEditingLogId(null);
        return;
      }
      closeJournalPanel();
    };
  });
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (flyoverActive.current) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector("[role=dialog][aria-modal=true]")) return;
      escRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Quick add pick: fly to the place and open the existing add form prefilled. The open
  // trip (if any) stays selected, so the form's confirm attaches the pin to it.
  const handleQuickAddPick = (r) => {
    const lat = parseFloat(Number(r.lat).toFixed(4));
    const lon = parseFloat(Number(r.lng).toFixed(4));
    setClickedCoords({ lat, lon });
    setNewPinName(r.name);
    setNewPinCity(placeLine(r) || r.name);
    setNewPinCountryCode(String(r.countryCode || "").toUpperCase());
    setActivePin(null);
    setIsAddingLog(false);
    setActiveTab("Journals");
    setIsAddingEntry(true);
    setFlyTo({ lat, lon, at: Date.now() });
  };

  const handleHoverRegion = (name) => {
    setHoveredCountry(name || null);
  };

  // Reset inline edit modes whenever the active pin changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing load on mount, unchanged in v2 PR 1
    setIsEditingPin(false);
    setEditingLogId(null);
  }, [activePin?.id]);

  // ----------------------------------------------------
  // DYNAMIC PIN MANAGEMENT (CRUD stays here — coupled to form/HUD state)
  // ----------------------------------------------------
  const handleAddPin = async () => {
    if (!newPinName || !newPinCity) return; // Basic validation
    if (!clickedCoords) return; // no place picked, nothing to create
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
      // journey_id: the open trip if one is open, else the owner's existing "Imported"
      // journey (looked up by name, never created here).
      if (activeJourneyId && !String(activeJourneyId).startsWith("__")) {
        pinFields.journey_id = activeJourneyId;
      } else {
        // If it is missing from the list, omit it: the DB trigger routes the pin to Imported.
        const imported = journeys.find((j) => j.title === "Imported");
        if (imported?.id) pinFields.journey_id = imported.id;
      }

      // Quick add only: ISO 3166-1 alpha-2 from the geocoder (geohash fills in the DB).
      if (/^[A-Z]{2}$/.test(newPinCountryCode)) pinFields.country_code = newPinCountryCode;

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
      setNewPinCountryCode("");
      setNewPinStartDate(new Date().toISOString().split("T")[0]);
      setNewPinEndDate(new Date().toISOString().split("T")[0]);
      setClickedCoords(null);

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

  // Hand edits to location or coordinates after a quick add pick: the geocoder's country
  // code no longer describes the place, so clear it (the DB fills it on insert if needed).
  const editNewPinCity = (v) => { setNewPinCity(v); setNewPinCountryCode(""); };
  const editClickedCoords = (v) => { setClickedCoords(v); setNewPinCountryCode(""); };

  // REMOVE: one call at a time, aborted after 10 s. The dialog stays closable throughout;
  // CANCEL aborts the call. Errors and timeouts show inline in the dialog.
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const removeCtl = useRef(null);
  const cancelRemove = () => {
    removeCtl.current?.abort();
    removeCtl.current = null;
    setRemoveBusy(false);
    setRemoveError("");
    setIsConfirmingDelete(false);
  };
  const handleRemovePin = async () => {
    if (!activePin || removeCtl.current) return;
    const id = activePin.id;
    const ctl = new AbortController();
    removeCtl.current = ctl;
    const timer = setTimeout(() => ctl.abort(), 10000);
    setRemoveBusy(true);
    setRemoveError("");
    try {
      const { error, deleted } = await deletePinRow(id, ctl.signal);
      if (ctl.signal.aborted) throw new Error("timeout");
      if (error) throw error;
      if (!deleted) throw new Error("not removed");
      // Soft deleted on the server. Close the dialog and drop the pin everywhere it is shown.
      setIsConfirmingDelete(false);
      setPins((prev) => prev.filter((p) => p.id !== id));
      setActivePin(null);
      setClusterPins((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
      reloadTravelData();
    } catch (e) {
      // Cancelled by the user: the dialog is already closed, say nothing.
      if (removeCtl.current === ctl) {
        console.error(e);
        setRemoveError("This memory could not be removed. Please try again.");
      }
    } finally {
      clearTimeout(timer);
      if (removeCtl.current === ctl) { removeCtl.current = null; setRemoveBusy(false); }
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

  const handleShareJourney = async (journey) => {
    if (!journey?.id) return null;
    try {
      const { data, error } = await shareJourneyRow(
        journey.id,
        journey.share_token || null
      );
      if (error) throw error;
      await reloadTravelData();
      return data;
    } catch (err) {
      console.error(err);
      alert(err.message || "Error sharing journey.");
      return null;
    }
  };

  const handleStopSharingJourney = async (journey) => {
    if (!journey?.id) return false;
    try {
      const { error } = await stopSharingJourneyRow(journey.id);
      if (error) throw error;
      await reloadTravelData();
      return true;
    } catch (err) {
      console.error(err);
      alert(err.message || "Error stopping share.");
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

  return (
    <div className={`app-container${sheetOpen ? ` is-sheet-open${sheetCollapsed ? " is-sheet-collapsed" : ""}` : ""}${draftFace ? " is-draft-open" : ""}${draftOpen ? " is-draft-edit" : ""}`} style={sheetOpen ? { "--sheet-min": `${sheetHeaderPx}px` } : undefined}>
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
      {/* v2 globe: React Three Fiber scene, perspective camera orbiting a sphere. Data from MapLoader */}
      <div className="canvas-container">
        {isLoaded && geoJsonData && (
          <GlobeScene
            geoJson={geoJsonData}
            pins={draftGlobe ? [...pins, ...draftGlobe.pins] : pins}
            activePinId={draftGlobe ? null : activePin?.id || null}
            focusJourneyId={draftGlobe ? (draftGlobe.pins.length ? draftGlobe.key : null) : activeJourneyId}
            draftLegs={draftGlobe ? draftGlobe.legs : null}
            draftPlayKey={draftGlobe ? tripDraft.playKey : null}
            flyTo={flyTo}
            focusIsCollection={draftGlobe ? false : activeJourneyIsCollection}
            focusTitle={draftGlobe ? draftGlobe.title : activeJourney?.title || null}
            onPinClick={handlePinClick}
            onMapClick={handleMapClick}
            onHoverRegion={handleHoverRegion}
            panelOpen={draftGlobe ? !viewport.mobile : Boolean(session) && activeTab === "Journals"}
            panelWidth={viewport.mobile ? 0 : draftGlobe ? 452 : 350}
            sheetInset={draftGlobe && viewport.mobile ? Math.round(viewport.h * 0.5) : sheetInset}
            timeline={session ? timelineProps : null}
          />
        )}
      </div>

      {session && (
        <QuickAdd onPick={handleQuickAddPick} inTrip={activeJourneyId != null && !String(activeJourneyId).startsWith("__") && !activeJourneyIsCollection} />
      )}

      {session && draftFace && !addSearchOpen && (
        <TripDraft
          face={draftFace === "edit" ? "edit" : "start"}
          text={tripDraft.text}
          setText={(t) => setTripDraft((cur) => ({ ...cur, text: t }))}
          onSubmitText={submitDraftText}
          parsing={draftBusy.parsing}
          error={draftBusy.error}
          stub={tripDraft.stub}
          onStartGuided={() => { openDraft("edit"); setActiveTab("Map"); }}
          onAddSingle={() => { if (tripDraft.face) closeDraft(); setAddSearchOpen(true); }}
          draft={tripDraft.draft}
          setDraft={(fn) => setTripDraft((cur) => ({ ...cur, draft: typeof fn === "function" ? fn(cur.draft) : fn }))}
          onSave={saveTripDraft}
          saving={draftBusy.saving}
          saveError={draftBusy.saveError}
          onClose={tripDraft.face ? closeDraft : null}
          onDiscard={discardDraft}
          resumable={!tripDraft.face && tripDraft.draft.stops.length > 0}
          onResume={() => openDraft("edit")}
        />
      )}

      {session && addSearchOpen && (
        <QuickAdd
          dialog
          inTrip={activeJourneyId != null && !String(activeJourneyId).startsWith("__") && !activeJourneyIsCollection}
          onPick={(r) => { setAddSearchOpen(false); handleQuickAddPick(r); }}
          onCancel={() => setAddSearchOpen(false)}
        />
      )}

      <AppShell
        activeTab={activeTab}
        setActiveTab={(tab) => (tab === "Map" ? closeJournalPanel() : setActiveTab(tab))}
        hoveredCountry={hoveredCountry}
        showProfileMenu={showProfileMenu}
        setShowProfileMenu={setShowProfileMenu}
        showFlightPaths={showFlightPaths}
        setShowFlightPaths={setShowFlightPaths}
        sessionEmail={session?.user?.email}
        onSignOut={() => supabase.auth.signOut()}
        onAddEntry={() => setAddSearchOpen(true)}
        onOpenJournalsTab={() => { setReviewOpen(false); setClusterPins(null); setActivePin(null); setActiveJourneyId(null); setActiveTab("Journals"); }}
      >
        {session && (
          <JournalsPanel
            sheet={viewport.mobile ? { collapsed: sheetCollapsed, setCollapsed: setSheetCollapsed, headerPx: sheetHeaderPx, setHeaderPx: setSheetHeaderPx } : null}
            journeysLoading={!journeysLoaded}
            activeTab={activeTab}
            isAddingEntry={isAddingEntry}
            savingTo={activeJourneyId && !String(activeJourneyId).startsWith("__") && activeJourney?.title ? activeJourney.title : "Imported"}
            activePin={activePin}
            activeJourney={activeJourney}
            clusterPins={clusterPins}
            journeys={journeys}
            newPinName={newPinName}
            setNewPinName={setNewPinName}
            newPinCity={newPinCity}
            setNewPinCity={editNewPinCity}
            newPinStartDate={newPinStartDate}
            setNewPinStartDate={setNewPinStartDate}
            newPinEndDate={newPinEndDate}
            setNewPinEndDate={setNewPinEndDate}
            clickedCoords={clickedCoords}
            setClickedCoords={editClickedCoords}
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
            removeBusy={removeBusy}
            reviewOpen={reviewOpen}
            setReviewOpen={setReviewOpen}
            removeError={removeError}
            cancelRemove={cancelRemove}
            onBackFromPin={handleBackFromPin}
            onSelectPin={handleSelectPinFromList}
            onSelectJourney={(journey) => {
              setActiveJourneyId(journey.id);
              setClusterPins(null);
              setActivePin(null);
            }}
            onBackFromJourney={() => setActiveJourneyId(null)}
            onTypeTrip={(face) => { openDraft(face === "guided" ? "edit" : "start"); setActiveTab("Map"); setActiveJourneyId(null); setActivePin(null); }}
            onBackFromCluster={() => setClusterPins(null)}
            onCreateJourney={handleCreateJourney}
            onUpdateJourney={handleUpdateJourney}
            onSoftDeleteJourney={handleSoftDeleteJourney}
            onShareJourney={handleShareJourney}
            onStopSharingJourney={handleStopSharingJourney}
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
