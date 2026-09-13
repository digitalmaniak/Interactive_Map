"use client";

import { useEffect, useState } from "react";
import { loadPins as fetchPinsFromApi } from "../lib/pins/api";

/**
 * Pins list state + load-on-session extracted from MapCanvas.
 * Behavior-identical: fetch when session is present; expose pins/setPins for CRUD handlers that remain in MapCanvas.
 */
export function usePins(session) {
  const [pins, setPins] = useState([]);

  useEffect(() => {
    if (!session) return;
    const loadPins = async () => {
      const { data, error } = await fetchPinsFromApi();
      if (error) {
        console.error("Failed to load pins from Supabase", error);
      } else if (data) {
        setPins(data);
      }
    };
    loadPins();
  }, [session]);

  return { pins, setPins };
}
