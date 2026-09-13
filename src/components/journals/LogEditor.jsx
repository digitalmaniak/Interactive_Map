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
    <div className="editorial-card" style={{ background: "var(--paper-soft)", padding: "0.75rem", marginBottom: "1rem" }}>
      <input type="text" placeholder={titlePlaceholder} className="panel-input" value={title} onChange={(e) => onTitleChange(e.target.value)} />
      <textarea placeholder="Experience details..." className="panel-textarea" value={content} onChange={(e) => onContentChange(e.target.value)} />
      {showDate ? (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <select value={category} onChange={(e) => onCategoryChange(e.target.value)} style={{ flex: 1, padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--stone)", fontSize: "0.8rem", color: "var(--ink)", background: "var(--surface)", borderRadius: "10px" }}>
            <option value="Experience">Experience</option>
            <option value="Restaurant">Restaurant</option>
            <option value="Lodging">Lodging</option>
            <option value="Transit">Transit</option>
          </select>
          <input type="date" value={logDate || ""} onChange={(e) => onLogDateChange(e.target.value)} style={{ flex: 1, padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--stone)", fontSize: "0.8rem", color: "var(--ink)", background: "var(--surface)", borderRadius: "10px" }} />
        </div>
      ) : (
        <select value={category} onChange={(e) => onCategoryChange(e.target.value)} style={{ width: "100%", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--stone)", marginBottom: "0.5rem", fontSize: "0.8rem", color: "var(--ink)", background: "var(--surface)", borderRadius: "10px" }}>
          <option value="Experience">Experience</option>
          <option value="Restaurant">Restaurant</option>
          <option value="Lodging">Lodging</option>
          <option value="Transit">Transit</option>
        </select>
      )}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="glass-pill btn-green" style={{ flex: 1, padding: "0.4rem", fontSize: "0.7rem", display: "flex", justifyContent: "center" }} onClick={onSave}>SAVE LOG</button>
        <button className="glass-pill icon-button" style={{ flex: 1, padding: "0.4rem", fontSize: "0.7rem", background: "var(--paper-soft)", color: "var(--muted)", border: "1px solid var(--stone)", display: "flex", justifyContent: "center" }} onClick={onCancel}>CANCEL</button>
      </div>
    </div>
  );
}
