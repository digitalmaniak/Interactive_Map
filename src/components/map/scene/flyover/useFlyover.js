"use client";
// Flyover driver. Issues goals to the single CameraController through moveRef (no second
// camera system) and steps through the pure plan from flyoverPlan.js on a rAF clock, so it
// runs in force3d lite mode too. A user drag or wheel replaces or clears moveRef; the
// driver sees its issued goal is gone and pauses.
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildFlyoverPlan } from "./flyoverPlan";
import { FLYOVER, easeInOutCubic } from "./flyoverTiming";
import { flyoverActive } from "./flyoverState";

const IDLE = { playing: false, paused: false, done: false, legIndex: -1, stopIndex: -1, pinId: null, legId: null };

export default function useFlyover({ legs, enabled, tripKey, reducedMotion, moveRef, fov, endGoal }) {
  // State is tagged with the trip it belongs to; another trip (or none) always reads as
  // idle, so a flyover can never carry over into the next journal.
  const [state, setState] = useState({ ...IDLE, key: null });
  const r = useRef({ plan: null, i: 0, t0: 0, elapsed: 0, issued: null, playing: false, raf: 0 });

  const publish = useCallback((patch) => {
    setState((prev) => {
      const next = { ...prev, ...patch, key: tripKey };
      if (typeof window !== "undefined") {
        window.__flyoverDebug = { playing: next.playing, paused: next.paused, legIndex: next.legIndex, stopIndex: next.stopIndex, done: next.done };
      }
      return next;
    });
  }, [tripKey]);

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
    const cur = state.key === tripKey ? state : IDLE;
    if (!f.plan || cur.done || !cur.paused) {
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
  }, [enabled, legs, reducedMotion, state, tripKey, enter, publish]);

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
    const was = f.playing || (state.key === tripKey && state.paused);
    f.playing = false; cancelAnimationFrame(f.raf); f.raf = 0;
    f.plan = null; f.issued = null;
    publish({ ...IDLE });
    if (was && enabled) moveRef.current = { ...endGoal() };
  }, [enabled, endGoal, moveRef, publish, state, tripKey]);

  const toggle = useCallback(() => { if (r.current.playing) pause(); else play(); }, [pause, play]);

  // Changing trips, leaving trip view or unmounting: cancel the timer, drop the plan and
  // release the camera if our goal is still the active request. Never starts anything.
  useEffect(() => {
    const f = r.current;
    return () => {
      f.playing = false; cancelAnimationFrame(f.raf); f.raf = 0; f.plan = null;
      if (f.issued && moveRef.current === f.issued) moveRef.current = null;
      f.issued = null;
      flyoverActive.current = false;
      if (typeof window !== "undefined") window.__flyoverDebug = { playing: false, paused: false, legIndex: -1, stopIndex: -1, done: false };
    };
  }, [enabled, tripKey, moveRef]);

  // Outside trip view the flyover always reads as idle (refs were reset above).
  const live = enabled && state.key === tripKey ? state : IDLE;
  useEffect(() => { flyoverActive.current = !!(live.playing || live.paused); }, [live.playing, live.paused]);
  return { state: live, play, pause, stop, toggle };
}
