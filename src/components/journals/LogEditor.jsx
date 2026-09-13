"use client";

/**
 * Shared add/edit log field UI used inside PinDetail.
 * Presentational — values and handlers come from MapCanvas via JournalsPanel → PinDetail.
 */
export default function LogEditor({
  title,
  content,
  category,
  logDate,
  showDate = false,
  titlePlaceholder = "Log Title",
  onTitleChange,
  onContentChange,
  onCategoryChange,
  onLogDateChange,
  onSave,
  onCancel,
}) {
  return (
    <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.1)", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem" }}>
      <input type="text" placeholder={titlePlaceholder} className="panel-input" value={title} onChange={(e) => onTitleChange(e.target.value)} />
      <textarea placeholder="Experience details..." className="panel-textarea" value={content} onChange={(e) => onContentChange(e.target.value)} />
      {showDate ? (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <select value={category} onChange={(e) => onCategoryChange(e.target.value)} style={{ flex: 1, padding: "0.4rem", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.15)", fontSize: "0.8rem", color: "#111827", background: "#fff" }}>
            <option value="Experience">Experience</option>
            <option value="Restaurant">Restaurant</option>
            <option value="Lodging">Lodging</option>
            <option value="Transit">Transit</option>
          </select>
          <input type="date" value={logDate || ""} onChange={(e) => onLogDateChange(e.target.value)} style={{ flex: 1, padding: "0.4rem", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.15)", fontSize: "0.8rem", color: "#111827", background: "#fff" }} />
        </div>
      ) : (
        <select value={category} onChange={(e) => onCategoryChange(e.target.value)} style={{ width: "100%", padding: "0.4rem", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.15)", marginBottom: "0.5rem", fontSize: "0.8rem", color: "#111827", background: "#fff" }}>
          <option value="Experience">Experience</option>
          <option value="Restaurant">Restaurant</option>
          <option value="Lodging">Lodging</option>
          <option value="Transit">Transit</option>
        </select>
      )}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="glass-pill btn-green" style={{ flex: 1, padding: "0.4rem", fontSize: "0.7rem", display: "flex", justifyContent: "center" }} onClick={onSave}>SAVE LOG</button>
        <button className="glass-pill icon-button" style={{ flex: 1, padding: "0.4rem", fontSize: "0.7rem", background: "rgba(0,0,0,0.05)", color: "#374151", display: "flex", justifyContent: "center" }} onClick={onCancel}>CANCEL</button>
      </div>
    </div>
  );
}
