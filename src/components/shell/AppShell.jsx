"use client";

import Crosshairs from "./Crosshairs";

/**
 * Layout chrome extracted from MapCanvas: nav tabs (Map | Journals),
 * exploring badge (hover only), profile bubble (flight-path toggle + sign out),
 * ADD ENTRY button, and a children slot for JournalsPanel.
 * Presentational. No map or auth logic.
 */
export default function AppShell({
  activeTab,
  setActiveTab,
  hoveredCountry,
  showProfileMenu,
  setShowProfileMenu,
  showFlightPaths,
  setShowFlightPaths,
  sessionEmail,
  onSignOut,
  onAddEntry,
  onOpenJournalsTab,
  children,
}) {
  const handle = sessionEmail?.split("@")[0] || "wanderer";
  return (
    <div className="ui-layer">
      <Crosshairs />

      {/* Top left: wordmark */}
      <div className="top-left-group">
        <div className="v2-wordmark">Odyssey</div>
      </div>

      {/* Top center: nav */}
      <div className="top-center-group">
        <nav className="v2-nav" aria-label="Primary">
          <button
            type="button"
            className={`v2-nav-item${activeTab === "Map" ? " active" : ""}`}
            aria-current={activeTab === "Map" ? "page" : undefined}
            onClick={() => setActiveTab("Map")}
          >
            Map
          </button>
          <button
            type="button"
            className={`v2-nav-item${activeTab === "Journals" ? " active" : ""}`}
            aria-current={activeTab === "Journals" ? "page" : undefined}
            onClick={onOpenJournalsTab}
          >
            Journals
          </button>
        </nav>

        {hoveredCountry ? (
          <div className="v2-region" aria-live="polite">
            <span className="v2-eyebrow">Region</span>
            <span className="v2-region-name">{hoveredCountry}</span>
          </div>
        ) : null}
      </div>

      {/* Journals sidebar, composed by MapCanvas via children */}
      {children}

      {/* Bottom left: profile */}
      <div className="bottom-left-group">
        {showProfileMenu && (
          <div className="v2-menu" role="menu">
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={showFlightPaths}
              className={`v2-btn v2-btn-ghost v2-btn-sm${showFlightPaths ? " is-on" : ""}`}
              onClick={() => setShowFlightPaths(!showFlightPaths)}
            >
              {showFlightPaths ? "Hide flight paths" : "Show flight paths"}
            </button>
            <button type="button" role="menuitem" className="v2-btn v2-btn-ghost v2-btn-sm" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        )}
        <button
          type="button"
          className="v2-profile"
          aria-expanded={showProfileMenu}
          aria-haspopup="menu"
          onClick={() => setShowProfileMenu(!showProfileMenu)}
        >
          <span className="v2-profile-dot" aria-hidden="true" />
          <span className="v2-mono-label">{handle}</span>
        </button>
      </div>

      {/* Bottom right: primary action */}
      <div className="bottom-right-group">
        <button type="button" className="v2-btn v2-btn-primary v2-add" onClick={onAddEntry}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add entry
        </button>
      </div>
    </div>
  );
}
