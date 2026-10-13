"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadPins as fetchPinsFromApi } from "../lib/pins/api";
import { loadJourneys, groupPinsByJourney } from "../lib/journeys/api";

/**
 * Load journeys + pins for the signed-in user.
 * Exposes flat `pins` for GlobeScene and `journeys` (with places) for JournalsPanel.
 */
export function useTravelData(session) {
  const [pins, setPins] = useState([]);
  const [journeyRows, setJourneyRows] = useState([]);
  // False until the first journeys fetch settles, so the UI can tell loading from empty.
  const [journeysLoaded, setJourneysLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [journeysRes, pinsRes] = await Promise.all([
      loadJourneys(),
      fetchPinsFromApi(),
    ]);
    if (journeysRes.error) {
      console.error("Failed to load journeys from Supabase", journeysRes.error);
    } else {
      setJourneyRows(journeysRes.data || []);
    }
    setJourneysLoaded(true);
    if (pinsRes.error) {
      console.error("Failed to load pins from Supabase", pinsRes.error);
    } else if (pinsRes.data) {
      setPins(pinsRes.data);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing load on mount, unchanged in v2 PR 1
    reload();
  }, [session, reload]);

  // Derive places onto journeys from live pins so CRUD via setPins stays in sync.
  const journeys = useMemo(
    () => groupPinsByJourney(journeyRows, pins),
    [journeyRows, pins]
  );

  return { journeys, pins, setPins, reload, journeysLoaded };
}
