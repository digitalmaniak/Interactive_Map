"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Crosshairs from "./Crosshairs";
import { addEntryLabel } from "../../lib/shell/addLabel";

/**
 * Layout chrome extracted from MapCanvas: nav tabs (Map | Journals),
 * exploring badge (hover only), profile bubble (flight-path toggle + sign out),
 * ADD ENTRY button, and a children slot for JournalsPanel.
 * Presentational. No map or auth logic.
 */
const DESKTOP_MQ = "(min-width: 768px)";
function subscribeDesktop(cb) {
  const mq = window.matchMedia(DESKTOP_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export default function AppShell({
  activeTab,
  setActiveTab,
  hoveredCountry,
  showProfileMenu,
  setShowProfileMenu,
  sessionEmail,
  onSignOut,
  onAddEntry,
  addTripName = null, // open trip's name: the button reads Add stop to [name]
  onOpenJournalsTab,
  children,
}) {
  // Desktop (768 px and up) stacks wordmark, profile and Add entry top left. Phones keep the
  // bottom corners.
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP_MQ).matches, () => false);
  // Profile menu: Esc or a click outside closes it.
  const profileRef = useRef(null);
  useEffect(() => {
    if (!showProfileMenu) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); setShowProfileMenu(false); } };
    const onDown = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfileMenu(false); };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown, true);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("pointerdown", onDown, true); };
  }, [showProfileMenu, setShowProfileMenu]);
  // Add entry label: names over 18 chars use Add stop; CSS ellipsis covers the rest.
  const addText = addEntryLabel(addTripName);
  const addRef = useRef(null);

  const handle = sessionEmail?.split("@")[0] || "wanderer";
  const addButton = (
        <button ref={addRef} type="button" className="v2-btn v2-btn-primary v2-add" onClick={onAddEntry} title={addText.title} aria-label={addText.title || addText.label}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          <span className="v2-add-label">{addText.label}</span>
          <kbd className="v2-add-key" aria-hidden="true">/</kbd>
        </button>
  );
  return (
    <div className="ui-layer">
      <Crosshairs />

      {/* Top left: wordmark */}
      <div className={`top-left-group${desktop ? " is-stack" : ""}`}>
        <div className="v2-wordmark">Odyssey</div>
        {desktop && (
          <div className="v2-profile-wrap" ref={profileRef}>
            <button
              type="button"
              className="v2-profile is-quiet"
              aria-expanded={showProfileMenu}
              aria-haspopup="menu"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <span className="v2-profile-dot" aria-hidden="true" />
              <span className="v2-mono-label">{handle}</span>
              <svg className="v2-profile-chev" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M2 3.5l3 3 3-3" /></svg>
            </button>
            {showProfileMenu && (
              <div className="v2-menu v2-profile-menu" role="menu">
                <button type="button" role="menuitem" className="v2-btn v2-btn-ghost v2-btn-sm" onClick={onSignOut}>Sign out</button>
              </div>
            )}
          </div>
        )}
        {desktop && addButton}
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

      {/* Phones: profile bottom left, Add entry bottom right */}
      {!desktop && (
      <div className="bottom-left-group" ref={profileRef}>
        {showProfileMenu && (
          <div className="v2-menu" role="menu">
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

      )}
      {!desktop && (
      <div className="bottom-right-group">
        {addButton}
      </div>
      )}
    </div>
  );
}
