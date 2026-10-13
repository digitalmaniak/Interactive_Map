"use client";
import { useEffect, useState } from "react";

// Mobile layout (under 768 px wide): the journals panel is a bottom sheet. Tracks the
// breakpoint and the viewport height so the globe can centre above the sheet.
export const SHEET_BREAKPOINT = "(max-width: 767px)";
export const SHEET_HEADER_PX = 96; // grab handle + panel header row, collapsed state

export function useMobileViewport() {
  const [vp, setVp] = useState({ mobile: false, h: 0 });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(SHEET_BREAKPOINT);
    const read = () => setVp((cur) => (cur.mobile === mq.matches && cur.h === window.innerHeight ? cur : { mobile: mq.matches, h: window.innerHeight }));
    read();
    mq.addEventListener("change", read);
    window.addEventListener("resize", read);
    return () => { mq.removeEventListener("change", read); window.removeEventListener("resize", read); };
  }, []);
  return vp;
}
