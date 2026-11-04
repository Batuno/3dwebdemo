// Dev-only frame-time probe: the longest frame in the 1.5 s after each route change.
// Loaded only in development (or a build made with VITE_PROBE=1 and opened with ?debug).
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { toHash } from '../lib/routing';
import { useAppStore } from '../store/useAppStore';

const WINDOW_MS = 1500;

interface Run {
  from: string;
  to: string;
  start: number;
  max: number;
  /** Longest main-thread task in the window: the part of a hitch that blocks input, whatever the GPU. */
  task: number;
}

export default function TransitionProbe() {
  const run = useRef<Run | null>(null);
  const last = useRef(0);
  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes?.includes('longtask')) return undefined;
    const obs = new PerformanceObserver((list) => {
      const r = run.current;
      if (!r) return;
      for (const e of list.getEntries()) {
        if (e.startTime + e.duration >= r.start) r.task = Math.max(r.task, e.duration);
      }
    });
    obs.observe({ type: 'longtask', buffered: false });
    return () => obs.disconnect();
  }, []);
  useEffect(
    () =>
      useAppStore.subscribe((s, prev) => {
        if (s.route === prev.route) return;
        const from = toHash(prev.route);
        const to = toHash(s.route);
        if (from === to) return;
        if (run.current) report(run.current);
        run.current = { from, to, start: performance.now(), max: 0, task: 0 };
      }),
    [],
  );
  useFrame(() => {
    const now = performance.now();
    const ms = last.current ? now - last.current : 0;
    last.current = now;
    // Recent frame times, so scripts can compare a transition against the steady frame.
    const w = window as unknown as { __frameTimes?: number[] };
    const ring = (w.__frameTimes ??= []);
    ring.push(ms);
    if (ring.length > 90) ring.shift();
    const r = run.current;
    if (!r) return;
    r.max = Math.max(r.max, ms);
    if (now - r.start > WINDOW_MS) {
      report(r);
      run.current = null;
    }
  });
  return null;
}

function report(r: Run) {
  const ms = Math.round(r.max);
  const task = Math.round(r.task);
  console.info('[transition]', r.from, '→', r.to, ms, `(longest task ${task} ms)`);
  const w = window as unknown as { __transitions?: { from: string; to: string; ms: number; task: number }[] };
  (w.__transitions ??= []).push({ from: r.from, to: r.to, ms, task });
}
