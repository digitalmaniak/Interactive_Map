"use client";

import { formatPinDate } from "../../lib/pins/format";
import LogEditor from "./LogEditor";

/**
 * Pin detail view: back nav, delete confirm, edit pin form, logs list + LogEditor.
 * Presentational — state/handlers from MapCanvas via JournalsPanel.
 */
export default function PinDetail({
  activePin,
  isConfirmingDelete,
  setIsConfirmingDelete,
  isEditingPin,
  editPin,
  setEditPin,
  startEditingPin,
  handleUpdatePin,
  setIsEditingPin,
  editingLogId,
  editLog,
  setEditLog,
  startEditingLog,
  handleUpdateLog,
  setEditingLogId,
  handleDeleteLog,
  isAddingLog,
  setIsAddingLog,
  newLogTitle,
  setNewLogTitle,
  newLogContent,
  setNewLogContent,
  newLogCategory,
  setNewLogCategory,
  handleAddLog,
  handleRemovePin,
  onBack,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <button
        onClick={onBack}
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
              <LogEditor
                key={log.id || idx}
                title={editLog.title}
                content={editLog.content}
                category={editLog.category}
                logDate={editLog.log_date}
                showDate
                titlePlaceholder="Log Title"
                onTitleChange={(v) => setEditLog({ ...editLog, title: v })}
                onContentChange={(v) => setEditLog({ ...editLog, content: v })}
                onCategoryChange={(v) => setEditLog({ ...editLog, category: v })}
                onLogDateChange={(v) => setEditLog({ ...editLog, log_date: v })}
                onSave={handleUpdateLog}
                onCancel={() => setEditingLogId(null)}
              />
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
            <LogEditor
              title={newLogTitle}
              content={newLogContent}
              category={newLogCategory}
              showDate={false}
              titlePlaceholder="Log Title (e.g., Best Dinner)"
              onTitleChange={setNewLogTitle}
              onContentChange={setNewLogContent}
              onCategoryChange={setNewLogCategory}
              onSave={handleAddLog}
              onCancel={() => setIsAddingLog(false)}
            />
          ) : (
            <button className="glass-pill" style={{ width: "100%", background: "rgba(0,0,0,0.04)", border: "1px dashed #cbd5e1", color: "#475569", fontSize: "0.75rem", marginBottom: "1rem", padding: "0.5rem", cursor: "pointer" }} onClick={() => setIsAddingLog(true)}>+ ADD LOG ENTRY</button>
          )}

          <button className="glass-pill btn-red" style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: "0.5rem" }} onClick={() => setIsConfirmingDelete(true)}>REMOVE PIN</button>
        </div>
      )}
    </div>
  );
}
