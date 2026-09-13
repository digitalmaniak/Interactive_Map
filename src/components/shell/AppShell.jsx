"use client";

/**
 * Layout chrome extracted from MapCanvas: hamburger, nav tabs, exploring badge,
 * profile bubble (flight-path toggle + sign out), ADD ENTRY button, and a
 * children slot for JournalsPanel. Presentational — no map/auth logic.
 * Behavior-identical extract; no aesthetic redesign.
 */
export default function AppShell({
  activeTab,
  setActiveTab,
  hoveredCountry,
  pinsLength,
  showProfileMenu,
  setShowProfileMenu,
  showFlightPaths,
  setShowFlightPaths,
  sessionEmail,
  onSignOut,
  onMigrateData,
  onAddEntry,
  onOpenJournalsTab,
  children,
}) {
  return (
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
            onClick={onOpenJournalsTab}
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

      {/* Travel Journals Sidebar — composed by MapCanvas via children */}
      {children}

      {/* Bottom Left */}
      <div className="bottom-left-group">
        {pinsLength === 0 && (
          <button className="glass-pill btn-green" style={{ width: "200px" }} onClick={onMigrateData}>
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
              onClick={onSignOut}
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
            <span className="name">{sessionEmail?.split('@')[0].toUpperCase() || "WANDERER"}</span>
            <span className="status">ONLINE</span>
          </div>
          <div className="status-dot"></div>
        </div>
      </div>

      {/* Bottom Right */}
      <div className="bottom-right-group">
        <button className="glass-base glass-pill icon-button btn-icon-right" onClick={onAddEntry}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
          <span style={{fontSize: "0.8rem", fontWeight: "700", color: "#0f172a"}}>ADD ENTRY</span>
        </button>
      </div>
    </div>
  );
}
