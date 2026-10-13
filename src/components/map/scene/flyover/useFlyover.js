"use client";
// Flyover driver. Issues goals to the single CameraController through moveRef (no second
// camera system) and steps through the pure plan from flyoverPlan.js on a rAF clock, so it
// runs in force3d lite mode too. A user drag or wheel replaces or clears moveRef; the
// driver sees its issued goal is gone and pauses.
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildFlyoverPlan } from "./flyoverPlan";
import { FLYOVER, easeInOutCubic } from "./flyoverTiming";

const IDLE = { playing: false, paused: false, done: false, legIndex: -1, stopIndex: -1, pinId: null, legId: null };

export default function useFlyover({ legs, enabled, reducedMotion, moveRef, fov, endGoal }) {
  const [state, setState] = useState(IDLE);
  const r = useRef({ plan: null, i: 0, t0: 0, elapsed: 0, issued: null, playing: false, raf: 0 });

  const publish = useCallback((patch) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      if (typeof window !== "undefined") {
        window.__flyoverDebug = { playing: next.playing, paused: next.paused, legIndex: next.legIndex, stopIndex: next.stopIndex, done: next.done };
      }
      return next;
    });
  }, []);

  const issue = useCallback((step, msLeft) => {
    const f = r.current;
    if (step.kind === "end") {
      f.issued = { ...endGoal(), ms: msLeft, ease: easeInOutCubic };
    } else if (step.kind === "move") {
      const stop = f.plan.stops[step.stopIndex];
      f.issued = {
        n: stop.v.clone().normalize(), D: FLYOVER.stopDist, tilt: THREE.MathUtils.degToRad(FLYOVER.tiltDeg), heading: 0,
        fov, trip: true, ms: msLeft, ease: easeInOutCubic,
      };
    } else return;
    moveRef.current = f.issued;
  }, [endGoal, fov, moveRef]);

  const enter = useCallback((i, msLeft) => {
    const f = r.current;
    const step = f.plan.steps[i];
    f.i = i; f.t0 = performance.now(); f.elapsed = step.ms - msLeft;
    if (step.kind !== "hold") issue(step, Math.max(reducedMotion ? 1 : 600, msLeft));
    const stop = f.plan.stops[step.stopIndex];
    publish({ legIndex: step.legIndex, stopIndex: step.stopIndex, pinId: step.kind === "end" ? null : stop?.pinId ?? null, legId: step.kind === "end" ? null : step.legId });
  }, [issue, publish, reducedMotion]);

  const tick = useCallback(() => {
    const f = r.current;
    if (!f.playing) return;
    const step = f.plan.steps[f.i];
    // User drag or wheel took the camera: pause where we are.
    if (f.issued && moveRef.current !== f.issued) {
      f.playing = false; f.elapsed += performance.now() - f.t0;
      publish({ playing: false, paused: true });
      return;
    }
    const t = f.elapsed + performance.now() - f.t0;
    if (t >= step.ms) {
      if (f.i + 1 >= f.plan.steps.length) {
        f.playing = false; f.issued = null;
        publish({ playing: false, paused: false, done: true, legIndex: -1, stopIndex: -1, pinId: null, legId: null });
        return;
      }
      enter(f.i + 1, f.plan.steps[f.i + 1].ms);
    }
    f.raf = requestAnimationFrame(() => r.current.tickRef());
  }, [enter, moveRef, publish]);
  useEffect(() => { r.current.tickRef = tick; }, [tick]);

  const play = useCallback(() => {
    const f = r.current;
    if (!enabled || f.playing) return;
    if (!f.plan || state.done || !state.paused) {
      f.plan = buildFlyoverPlan(legs, { reducedMotion });
      if (!f.plan.steps.length) return;
      f.playing = true;
      publish({ playing: true, paused: false, done: false });
      enter(0, f.plan.steps[0].ms);
    } else {
      // Resume: re-issue the current step from the live pose with the time left.
      f.playing = true;
      const step = f.plan.steps[f.i];
      const left = Math.max(0, step.ms - f.elapsed);
      publish({ playing: true, paused: false });
      enter(f.i, left);
    }
    cancelAnimationFrame(f.raf);
    f.raf = requestAnimationFrame(() => r.current.tickRef());
  }, [enabled, legs, reducedMotion, state.done, state.paused, enter, publish]);

  const pause = useCallback(() => {
    const f = r.current;
    if (!f.playing) return;
    f.playing = false; f.elapsed += performance.now() - f.t0;
    cancelAnimationFrame(f.raf);
    // Hold the camera where it is: a fresh goal at the live pose is not needed, clearing
    // the request cancels the tween on the next frame.
    if (moveRef.current === f.issued) moveRef.current = null;
    f.issued = null;
    publish({ playing: false, paused: true });
  }, [moveRef, publish]);

  const stop = useCallback(() => {
    const f = r.current;
    const was = f.playing || state.paused;
    f.playing = false; cancelAnimationFrame(f.raf);
    f.plan = null; f.issued = null;
    publish({ ...IDLE });
    if (was && enabled) moveRef.current = { ...endGoal() };
  }, [enabled, endGoal, moveRef, publish, state.paused]);

  const toggle = useCallback(() => { if (r.current.playing) pause(); else play(); }, [pause, play]);

  // Leaving trip view or changing trips resets the flyover.
  useEffect(() => {
    if (enabled) return undefined;
    const f = r.current;
    f.playing = false; cancelAnimationFrame(f.raf); f.plan = null; f.issued = null;
    return undefined;
  }, [enabled, legs, publish]);
  useEffect(() => () => cancelAnimationFrame(r.current.raf), []);

  // Outside trip view the flyover always reads as idle (refs were reset above).
  return { state: enabled ? state : IDLE, play, pause, stop, toggle };
}
