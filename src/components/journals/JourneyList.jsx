"use client";

import { useState } from "react";
import { formatJourneyDates } from "../../lib/journeys/format";
import { journeyShareUrl } from "../../lib/journeys/share";

const emptyForm = () => ({
  title: "",
  summary: "",
  date_start: "",
  date_end: "",
  tags: "",
  visibility: "private",
});

/**
 * Top-level journey list for Travel Journals.
 * Selecting a journey drills into its places (pins).
 * Supports create / edit metadata / soft-delete.
 */
export default function JourneyList({
  journeys,
  onSelectJourney,
  onCreateJourney,
  onUpdateJourney,
  onSoftDeleteJourney,
  onSetVisibility,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const copyShareLink = async (journey, e) => {
    e?.stopPropagation();
    if (!journey?.share_token) return;
    const url = journeyShareUrl(journey.share_token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(journey.id);
      setTimeout(() => setCopiedId((id) => (id === journey.id ? null : id)), 2000);
    } catch (err) {
      console.error(err);
      window.prompt("Copy share link:", url);
    }
  };

  const toggleVisibility = async (journey, nextVisibility, e) => {
    e?.stopPropagation();
    if (busy || !onSetVisibility) return;
    setBusy(true);
    try {
      await onSetVisibility(journey, nextVisibility);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (journey, e) => {
    e.stopPropagation();
    setShowCreate(false);
    setConfirmDeleteId(null);
    setEditingId(journey.id);
    setEditForm({
      title: journey.title || "",
      summary: journey.summary || "",
      date_start: journey.date_start || "",
      date_end: journey.date_end || "",
      tags: Array.isArray(journey.tags) ? journey.tags.join(", ") : "",
      visibility: journey.visibility === "unlisted" ? "unlisted" : "private",
    });
  };

  const cancelEdit = (e) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditForm(emptyForm());
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim() || busy || !onCreateJourney) return;
    setBusy(true);
    try {
      const ok = await onCreateJourney({ ...createForm });
      if (ok !== false) {
        setCreateForm(emptyForm());
        setShowCreate(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async (e, journeyId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editForm.title.trim() || busy || !onUpdateJourney) return;
    setBusy(true);
    try {
      const ok = await onUpdateJourney(journeyId, { ...editForm });
      if (ok !== false) {
        setEditingId(null);
        setEditForm(emptyForm());
      }
    } finally {
      setBusy(false);
    }
  };

  const requestDelete = (journey, e) => {
    e.stopPropagation();
    setEditingId(null);
    setShowCreate(false);
    setConfirmDeleteId(journey.id);
  };

  const confirmDelete = async (journey, e) => {
    e.stopPropagation();
    if (busy || !onSoftDeleteJourney) return;
    setBusy(true);
    try {
      await onSoftDeleteJourney(journey);
      setConfirmDeleteId(null);
    } finally {
      setBusy(false);
    }
  };

  const isProtected = (journey) =>
    journey.title === "Imported" || String(journey.id).startsWith("__");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexShrink: 0 }}>
        <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          Journeys
        </h2>
        {onCreateJourney && (
          <button
            type="button"
            className="glass-pill btn-green"
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0 }}
            onClick={() => {
              setShowCreate((v) => !v);
              setEditingId(null);
              setConfirmDeleteId(null);
            }}
            disabled={busy}
          >
            {showCreate ? "CLOSE" : "NEW JOURNEY"}
          </button>
        )}
      </div>
      <p style={{ fontSize: "0.85rem", color: "#4b5563", margin: 0, flexShrink: 0 }}>
        Your trips and collections. Open one to see its places.
      </p>

      {showCreate && (
        <form onSubmit={submitCreate} style={{ marginTop: "0.75rem", padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.03)", flexShrink: 0 }}>
          <label className="panel-label">Title *</label>
          <input
            type="text"
            className="panel-input"
            placeholder="e.g. Japan 2024"
            value={createForm.title}
            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            required
          />
          <label className="panel-label">Summary</label>
          <input
            type="text"
            className="panel-input"
            placeholder="Optional notes"
            value={createForm.summary}
            onChange={(e) => setCreateForm({ ...createForm, summary: e.target.value })}
          />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <div style={{ flex: 1 }}>
              <label className="panel-label">Start</label>
              <input type="date" className="panel-input" value={createForm.date_start} onChange={(e) => setCreateForm({ ...createForm, date_start: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="panel-label">End</label>
              <input type="date" className="panel-input" value={createForm.date_end} onChange={(e) => setCreateForm({ ...createForm, date_end: e.target.value })} />
            </div>
          </div>
          <label className="panel-label">Tags</label>
          <input
            type="text"
            className="panel-input"
            placeholder="comma, separated"
            value={createForm.tags}
            onChange={(e) => setCreateForm({ ...createForm, tags: e.target.value })}
          />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button type="submit" className="glass-pill btn-green" style={{ flex: 1, display: "flex", justifyContent: "center" }} disabled={busy || !createForm.title.trim()}>
              CREATE
            </button>
            <button
              type="button"
              className="glass-pill icon-button"
              style={{ flex: 1, background: "rgba(0,0,0,0.05)", border: "1px solid #ccc", padding: "0.5rem 1rem", fontSize: "0.7rem", fontWeight: 700, display: "flex", justifyContent: "center", color: "#374151" }}
              onClick={() => { setShowCreate(false); setCreateForm(emptyForm()); }}
              disabled={busy}
            >
              CANCEL
            </button>
          </div>
        </form>
      )}

      <div className="sidebar-scrollbar" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem", overflowY: "auto", paddingRight: "0.5rem" }}>
        {(journeys || []).map((journey) => {
          const placeCount = journey.places?.length || 0;
          const dates = formatJourneyDates(journey);
          const protectedJourney = isProtected(journey);

          if (editingId === journey.id) {
            return (
              <form
                key={journey.id}
                onSubmit={(e) => submitEdit(e, journey.id)}
                onClick={(e) => e.stopPropagation()}
                style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(37,99,235,0.35)", background: "rgba(37,99,235,0.04)" }}
              >
                <label className="panel-label">Title *</label>
                <input type="text" className="panel-input" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
                <label className="panel-label">Summary</label>
                <input type="text" className="panel-input" value={editForm.summary} onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })} />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <div style={{ flex: 1 }}>
                    <label className="panel-label">Start</label>
                    <input type="date" className="panel-input" value={editForm.date_start} onChange={(e) => setEditForm({ ...editForm, date_start: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="panel-label">End</label>
                    <input type="date" className="panel-input" value={editForm.date_end} onChange={(e) => setEditForm({ ...editForm, date_end: e.target.value })} />
                  </div>
                </div>
                <label className="panel-label">Tags</label>
                <input type="text" className="panel-input" placeholder="comma, separated" value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} />
                <label className="panel-label">Visibility</label>
                <select
                  className="panel-input"
                  value={editForm.visibility}
                  onChange={(e) => setEditForm({ ...editForm, visibility: e.target.value })}
                >
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted (share link)</option>
                </select>
                {editForm.visibility === "unlisted" && journey.share_token && (
                  <button
                    type="button"
                    className="glass-pill icon-button"
                    style={{ marginTop: "0.5rem", width: "100%", background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)", padding: "0.45rem 1rem", fontSize: "0.7rem", fontWeight: 700, display: "flex", justifyContent: "center", color: "#1d4ed8" }}
                    onClick={(e) => copyShareLink(journey, e)}
                    disabled={busy}
                  >
                    {copiedId === journey.id ? "COPIED" : "COPY SHARE LINK"}
                  </button>
                )}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button type="submit" className="glass-pill btn-green" style={{ flex: 1, display: "flex", justifyContent: "center" }} disabled={busy || !editForm.title.trim()}>SAVE</button>
                  <button type="button" className="glass-pill icon-button" style={{ flex: 1, background: "rgba(0,0,0,0.05)", border: "1px solid #ccc", padding: "0.5rem 1rem", fontSize: "0.7rem", fontWeight: 700, display: "flex", justifyContent: "center", color: "#374151" }} onClick={cancelEdit} disabled={busy}>CANCEL</button>
                </div>
              </form>
            );
          }

          return (
            <div
              key={journey.id}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "1rem",
                cursor: "pointer",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.05)",
                background: "rgba(0,0,0,0.02)",
                transition: "all 0.2s ease",
              }}
              onClick={() => onSelectJourney(journey)}
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {dates || "Undated"}
                  </div>
                  <div style={{ fontSize: "1.1rem", color: "#111827", fontWeight: 600, margin: "0.25rem 0" }}>
                    {journey.title}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#4b5563", lineHeight: 1.4 }}>
                    {placeCount} {placeCount === 1 ? "place" : "places"}
                    {journey.visibility === "unlisted" ? " · Unlisted" : ""}
                  </div>
                </div>
                {!protectedJourney && (onUpdateJourney || onSoftDeleteJourney || onSetVisibility) && (
                  <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                    {onUpdateJourney && (
                      <button
                        type="button"
                        title="Edit journey"
                        onClick={(e) => startEdit(journey, e)}
                        style={{ background: "transparent", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "6px", padding: "0.25rem 0.4rem", cursor: "pointer", color: "#4b5563", fontSize: "0.7rem", fontWeight: 700 }}
                        disabled={busy}
                      >
                        Edit
                      </button>
                    )}
                    {onSetVisibility && journey.visibility === "unlisted" && journey.share_token && (
                      <button
                        type="button"
                        title="Copy unlisted share link"
                        onClick={(e) => copyShareLink(journey, e)}
                        style={{ background: "transparent", border: "1px solid rgba(37,99,235,0.3)", borderRadius: "6px", padding: "0.25rem 0.4rem", cursor: "pointer", color: "#1d4ed8", fontSize: "0.7rem", fontWeight: 700 }}
                        disabled={busy}
                      >
                        {copiedId === journey.id ? "Copied" : "Copy link"}
                      </button>
                    )}
                    {onSetVisibility && (
                      <button
                        type="button"
                        title={journey.visibility === "unlisted" ? "Make private" : "Make unlisted and share"}
                        onClick={(e) =>
                          toggleVisibility(
                            journey,
                            journey.visibility === "unlisted" ? "private" : "unlisted",
                            e
                          )
                        }
                        style={{ background: "transparent", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "6px", padding: "0.25rem 0.4rem", cursor: "pointer", color: "#4b5563", fontSize: "0.7rem", fontWeight: 700 }}
                        disabled={busy}
                      >
                        {journey.visibility === "unlisted" ? "Private" : "Share"}
                      </button>
                    )}
                    {onSoftDeleteJourney && (
                      <button
                        type="button"
                        title="Delete journey"
                        onClick={(e) => requestDelete(journey, e)}
                        style={{ background: "transparent", border: "1px solid rgba(220,38,38,0.25)", borderRadius: "6px", padding: "0.25rem 0.4rem", cursor: "pointer", color: "#dc2626", fontSize: "0.7rem", fontWeight: 700 }}
                        disabled={busy}
                      >
                        Del
                      </button>
                    )}
                  </div>
                )}
              </div>
              {confirmDeleteId === journey.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ marginTop: "0.75rem", padding: "0.65rem", borderRadius: "6px", background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}
                >
                  <div style={{ fontSize: "0.8rem", color: "#7f1d1d", marginBottom: "0.5rem" }}>
                    Soft-delete &ldquo;{journey.title}&rdquo;? Places move to Imported.
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={(e) => confirmDelete(journey, e)}
                      disabled={busy}
                      style={{ flex: 1, background: "#dc2626", color: "white", border: "none", borderRadius: "6px", padding: "0.4rem", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}
                    >
                      DELETE
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                      disabled={busy}
                      style={{ flex: 1, background: "rgba(0,0,0,0.05)", border: "1px solid #ccc", borderRadius: "6px", padding: "0.4rem", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", color: "#374151" }}
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {(journeys || []).length === 0 && (
          <div style={{ textAlign: "center", color: "#4b5563", fontSize: "0.9rem", padding: "2rem 0" }}>
            No journeys yet. Create one or add a memory pin to the globe!
          </div>
        )}
      </div>
    </>
  );
}
