"use client";

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
}) {
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
