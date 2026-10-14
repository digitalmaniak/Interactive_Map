"use client";
import ModeIcon from "../shell/ModeIcon";
import { JOIN_MODES } from "../../lib/addentry/partOfTrip";

const MODE_NAME = { fly: "Fly", drive: "Drive", train: "Train", boat: "Boat", walk: "Walk", other: "Other" };

/**
 * New memory / pin form shown when isAddingEntry is true.
 * Presentational — state and handlers from MapCanvas via JournalsPanel.
 */
export default function AddMemoryForm({
  newPinName,
  setNewPinName,
  newPinCity,
  setNewPinCity,
  newPinStartDate,
  setNewPinStartDate,
  newPinEndDate,
  setNewPinEndDate,
  clickedCoords,
  setClickedCoords,
  newPinDetails,
  setNewPinDetails,
  onAddPin,
  onCancel,
  savingTo = "Imported",
  tripChoice = "place",
  setTripChoice,
  inTripTitle = null,
  newTripName = "",
  setNewTripName,
  trips = [],
  joinTripId = "",
  setJoinTripId,
  joinMode = null,
  setJoinMode,
  canJoinLeg = false,
}) {
  const choices = [["new", "New trip"], ["trip", inTripTitle ? "Add to this trip" : "Existing trip"], ["place", "Just a place"]];
  const noDate = !newPinStartDate && !newPinEndDate;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <h2 style={{ fontSize: "1.25rem", margin: "0 0 1rem 0", fontWeight: 700, color: "var(--v2-text)", flexShrink: 0 }}>New Memory Point</h2>
      <div className="v2-saving-to" role="note" style={{ margin: "-0.5rem 0 1rem", font: "400 11px/1.4 var(--v2-mono)", letterSpacing: "0.08em", color: "var(--v2-text-dim)", flexShrink: 0 }}>
        Saving to: <span style={{ color: "var(--v2-text)" }}>{savingTo}</span>
      </div>
      <div className="sidebar-scrollbar" style={{ overflowY: "auto", paddingRight: "0.5rem", flexGrow: 1 }}>
        <label className="panel-label">Title</label>
        <input type="text" placeholder="Title (e.g. Skiing)" className="panel-input" value={newPinName} onChange={(e) => setNewPinName(e.target.value)} />
        <label className="panel-label">Location</label>
        <input type="text" placeholder="Location (e.g. Alps)" className="panel-input" value={newPinCity} onChange={(e) => setNewPinCity(e.target.value)} />
        <div className="v2-seg" role="radiogroup" aria-label="Part of a trip?">
          {choices.map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={tripChoice === k} className={`v2-seg-btn${tripChoice === k ? " is-on" : ""}`} onClick={() => setTripChoice?.(k)}>{label}</button>
          ))}
        </div>
        {tripChoice === "new" && (
          <input type="text" className="panel-input v2-seg-sub" placeholder="Trip name" aria-label="New trip name" value={newTripName} onChange={(e) => setNewTripName?.(e.target.value)} />
        )}
        {tripChoice === "trip" && !inTripTitle && (
          <select className="panel-input v2-seg-sub" aria-label="Trip to add to" value={joinTripId} onChange={(e) => setJoinTripId?.(e.target.value)}>
            <option value="">Pick a trip</option>
            {trips.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        )}
        {tripChoice === "trip" && canJoinLeg && (
          <div className="v2-modes" role="radiogroup" aria-label="How did you get here?">
            <span className="v2-modes-q">How did you get here?</span>
            {JOIN_MODES.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={joinMode === m} aria-label={MODE_NAME[m]} title={MODE_NAME[m]} className={`v2-mode-btn${joinMode === m ? " is-on" : ""}`} onClick={() => setJoinMode?.(joinMode === m ? null : m)}><ModeIcon mode={m} /></button>
            ))}
          </div>
        )}
        <div className="v2-date-pair">
          <div>
            <label className="panel-label">Start Date</label>
            <input type="date" className="panel-input" value={newPinStartDate} onChange={(e) => setNewPinStartDate(e.target.value)} />
          </div>
          <div>
            <label className="panel-label">End Date</label>
            <input type="date" className="panel-input" value={newPinEndDate} onChange={(e) => setNewPinEndDate(e.target.value)} />
          </div>
        </div>
        {noDate && <p className="v2-nodate" role="note">No date yet</p>}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <div style={{ flex: 1 }}>
            <label className="panel-label">Latitude</label>
            <input type="number" step="0.0001" className="panel-input" value={clickedCoords?.lat ?? ""} onChange={(e) => setClickedCoords({ ...clickedCoords, lat: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="panel-label">Longitude</label>
            <input type="number" step="0.0001" className="panel-input" value={clickedCoords?.lon ?? ""} onChange={(e) => setClickedCoords({ ...clickedCoords, lon: e.target.value })} />
          </div>
        </div>
        <label className="panel-label">Initial Log</label>
        <textarea placeholder="Initial log entry details..." className="panel-textarea" value={newPinDetails} onChange={(e) => setNewPinDetails(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexShrink: 0 }}>
        <button className="glass-pill btn-green" style={{ flex: 1, display: "flex", justifyContent: "center" }} onClick={onAddPin}>ADD MEMORY</button>
        <button className="glass-pill icon-button" style={{ flex: 1, background: "var(--v2-surface-2)", border: "1px solid var(--v2-hairline)", padding: "0.5rem 1rem", fontSize: "0.7rem", fontWeight: 700, display: "flex", justifyContent: "center", color: "var(--v2-text-dim)" }} onClick={onCancel}>CANCEL</button>
      </div>
    </div>
  );
}
