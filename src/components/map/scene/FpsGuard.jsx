"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

// Watches delivered frame rate inside a Canvas. After a warmup it samples fixed
// windows; when `strikes` consecutive windows fall under `minFps` it calls onLow
// once. Gaps over 1s (tab hidden, render paused on input focus) reset the window
// so a deliberate pause is never mistaken for a slow device.
export default function FpsGuard({ minFps = 20, warmupMs = 2500, windowMs = 4000, strikes = 2, onLow }) {
  const s = useRef({ start: 0, last: 0, t0: 0, n: 0, bad: 0, done: false });
  useFrame(() => {
    const st = s.current;
    if (st.done) return;
    const now = performance.now();
    if (!st.start) { st.start = now; st.last = now; return; }
    const gap = now - st.last;
    st.last = now;
    if (now - st.start < warmupMs) return;
    if (gap > 1000) { st.t0 = 0; st.n = 0; return; }
    if (!st.t0) { st.t0 = now; st.n = 0; return; }
    st.n++;
    const span = now - st.t0;
    if (span < windowMs) return;
    const fps = (st.n * 1000) / span;
    st.bad = fps < minFps ? st.bad + 1 : 0;
    st.t0 = 0;
    st.n = 0;
    if (st.bad >= strikes) {
      st.done = true;
      onLow?.(fps);
    }
  });
  return null;
}
