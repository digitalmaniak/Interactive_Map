"use client";

/**
 * @deprecated Prefer useTravelData — kept as a thin alias for flat pins only.
 */
import { useTravelData } from "./useTravelData";

export function usePins(session) {
  const { pins, setPins } = useTravelData(session);
  return { pins, setPins };
}
