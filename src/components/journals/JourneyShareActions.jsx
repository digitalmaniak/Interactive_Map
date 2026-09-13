"use client";

import { useState } from "react";
import { copyJourneyShareUrl, isJourneyShared } from "../../lib/journeys/share";

/**
 * N1 one-action share controls.
 * Share = ensure token + unlisted + copy live /share/[token].
 * Stop sharing = flip to private (old URL dies via RLS).
 * Primary labels never say "unlisted".
 */
export default function JourneyShareActions({
  journey,
  onShareJourney,
  onStopSharingJourney,
  busy = false,
  setBusy,
  compact = false,
}) {
  const [copied, setCopied] = useState(false);
  const shared = isJourneyShared(journey);

  const markBusy = (value) => {
    if (typeof setBusy === "function") setBusy(value);
  };

  const handleShare = async (e) => {
    e?.stopPropagation();
    if (busy || !onShareJourney || !journey) return;
    markBusy(true);
    try {
      const updated = await onShareJourney(journey);
      if (!updated?.share_token) return;
      await copyJourneyShareUrl(updated.share_token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      markBusy(false);
    }
  };

  const handleStop = async (e) => {
    e?.stopPropagation();
    if (busy || !onStopSharingJourney || !journey) return;
    markBusy(true);
    try {
      await onStopSharingJourney(journey);
      setCopied(false);
    } finally {
      markBusy(false);
    }
  };

  const shareStyle = compact
    ? {
        background: "transparent",
        border: "1px solid var(--accent-border)",
        borderRadius: "6px",
        padding: "0.25rem 0.45rem",
        cursor: "pointer",
        color: "var(--accent-deep)",
        fontSize: "0.7rem",
        fontWeight: 700,
      }
    : {
        background: "var(--accent-tint)",
        border: "1px solid var(--accent-border)",
        padding: "0.4rem 0.75rem",
        fontSize: "0.7rem",
        fontWeight: 700,
        color: "var(--accent-deep)",
      };

  const stopStyle = compact
    ? {
        background: "transparent",
        border: "1px solid var(--stone)",
        borderRadius: "6px",
        padding: "0.25rem 0.45rem",
        cursor: "pointer",
        color: "var(--muted)",
        fontSize: "0.7rem",
        fontWeight: 700,
      }
    : {
        background: "var(--paper-soft)",
        border: "1px solid var(--stone)",
        padding: "0.4rem 0.75rem",
        fontSize: "0.7rem",
        fontWeight: 700,
        color: "var(--muted)",
      };

  return (
    <>
      <button
        type="button"
        className={compact ? undefined : "glass-pill icon-button"}
        title={shared ? "Copy the live share link" : "Share this journey — copy a live link"}
        onClick={handleShare}
        disabled={busy}
        style={shareStyle}
      >
        {copied ? "Copied" : "Share"}
      </button>
      {shared && (
        <button
          type="button"
          className={compact ? undefined : "glass-pill icon-button"}
          title="Stop sharing — the old link will stop working"
          onClick={handleStop}
          disabled={busy}
          style={stopStyle}
        >
          Stop sharing
        </button>
      )}
    </>
  );
}
