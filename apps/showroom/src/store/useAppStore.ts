import { create } from 'zustand';
import { clampTime, parseTime, TIME_DEFAULT, TIME_MAX, TIME_MIN, type RenderManifest } from '@bair/project-data';
import { parseHash, toHash, type Route } from '../lib/routing';
import { withFrozenFrame } from '../scene/dissolve';

/** Standing at a hotspot in a flat or at an outdoor point: the camera cuts there rather than gliding. */
const isStanding = (r: Route): boolean => r.view === 'outdoor' || (r.view === 'unit' && !!r.spot);

export type Quality = 'high' | 'medium' | 'low';
export type ColorBy = 'type' | 'status';

export interface HoverState {
  block: string | null;
  storey: number | null;
  stack: number | null;
}

interface AppState {
  route: Route;
  navigate: (r: Route) => void;
  syncFromHash: () => void;

  hover: HoverState;
  setHover: (h: Partial<HoverState>) => void;
  /** The storey the floor panel is on in block view. */
  selectedStorey: number;
  setSelectedStorey: (n: number) => void;

  /** Clock time, minutes after local midnight. Shared by every view. */
  time: number;
  setTime: (m: number) => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  advanceTime: (dt: number) => void;
  quality: Quality;
  setQuality: (q: Quality) => void;
  /** True once the viewer has picked a tier, which automatic changes must then respect. */
  qualityChosen: boolean;
  setAutoQuality: (q: Quality) => void;
  colorBy: ColorBy;
  setColorBy: (c: ColorBy) => void;

  /** Parking bay chosen per unit id. */
  parking: Record<string, string>;
  setParking: (unit: string, bay: string | null) => void;

  /** Bay highlighted in the garage view. */
  garageSelection: string | null;
  setGarageSelection: (id: string | null) => void;
  /** Unit that is choosing a parking bay. */
  parkingFor: string | null;
  setParkingFor: (id: string | null) => void;

  /** Rendered images available for this project; null means real-time everywhere. */
  manifest: RenderManifest | null;
  setManifest: (m: RenderManifest | null) => void;
  /** A rendered panorama is on screen, so post-processing must stay off it. */
  panoActive: boolean;
  setPanoActive: (v: boolean) => void;
  /** Optional HDB fittings switched on in the unit panel. */
  fittings: { partition: boolean };
  setFitting: (key: 'partition', on: boolean) => void;
  /** A flat is showing its top view instead of the dollhouse. */
  planMode: boolean;
  setPlanMode: (v: boolean) => void;
  /** Covers the jump between hotspots. */
  povFade: boolean;
  setPovFade: (v: boolean) => void;
  /** Where the camera should fly next. */
  flyTarget: { pos: [number, number, number]; tick: number } | null;
  flyTo: (pos: [number, number, number]) => void;
  /** Bumped by "Reset view" so the camera returns to the current shot. */
  resetTick: number;
  resetView: () => void;

  toast: { text: string; tick: number } | null;
  showToast: (text: string) => void;

  /** Set once the first frame is ready. */
  sceneReady: boolean;
  setSceneReady: () => void;
}

/** A full day plays in about 20 seconds. */
const MINUTES_PER_SECOND = (TIME_MAX - TIME_MIN) / 20;

let urlTimer: ReturnType<typeof setTimeout> | undefined;

/** Keeps ?t= in the address bar so a shared link opens at the same time of day. */
function writeTimeToUrl(minutes: number) {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    const params = new URLSearchParams(location.search);
    params.set('t', `${h}:${m}`);
    history.replaceState(null, '', `${location.pathname}?${params.toString().replace('%3A', ':')}${location.hash}`);
  }, 300);
}

const initialTime = (): number =>
  typeof location === 'undefined' ? TIME_DEFAULT : (parseTime(new URLSearchParams(location.search).get('t')) ?? TIME_DEFAULT);

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: the choice simply won't persist.
  }
};

/** Picks a starting quality from device hints; the user can change it any time. */
export function detectQuality(): Quality {
  if (typeof navigator === 'undefined') return 'high';
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  if (mobile) return 'low';
  if (mem <= 4 || cores <= 4) return 'medium';
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl?.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    // Integrated graphics: AMD "Radeon(TM) Graphics", Intel UHD/Iris
    if (/Radeon\(TM\) Graphics|Intel|UHD|Iris|Microsoft Basic/i.test(name)) return 'medium';
  } catch {
    return 'medium';
  }
  return 'high';
}

const initialQuality = (): Quality => read<Quality | null>('bair.quality', null) ?? detectQuality();

export const useAppStore = create<AppState>((set, get) => ({
  route: parseHash(typeof location === 'undefined' ? '' : location.hash),
  navigate: (r) => {
    const apply = () => {
      const hash = toHash(r);
      if (location.hash !== hash) location.hash = hash;
      set({ route: r, planMode: r.view === 'unit' && !r.spot ? get().planMode : false, hover: { block: null, storey: null, stack: null } });
    };
    // Into, out of or between standing points the camera jumps, so the view on screen is frozen first and
    // dissolves into the new one. That waits one frame at most; every other move glides and goes at once.
    if (isStanding(r) || isStanding(get().route)) withFrozenFrame(apply);
    else apply();
  },
  syncFromHash: () => {
    const r = parseHash(location.hash);
    if (toHash(r) !== toHash(get().route)) {
      set({ route: r });
    }
  },

  hover: { block: null, storey: null, stack: null },
  setHover: (h) => set({ hover: { ...get().hover, ...h } }),
  selectedStorey: 12,
  setSelectedStorey: (selectedStorey) => set({ selectedStorey, hover: { ...get().hover, storey: null } }),

  time: initialTime(),
  setTime: (m) => {
    const time = clampTime(m);
    writeTimeToUrl(time);
    set({ time, playing: false });
  },
  playing: false,
  setPlaying: (playing) => set({ playing }),
  advanceTime: (dt) => {
    const next = get().time + dt * MINUTES_PER_SECOND;
    set({ time: next > TIME_MAX ? TIME_MIN : next });
  },
  quality: initialQuality(),
  setQuality: (quality) => {
    write('bair.quality', quality);
    set({ quality, qualityChosen: true });
  },
  qualityChosen: read<Quality | null>('bair.quality', null) !== null,
  setAutoQuality: (quality) => set({ quality }),
  colorBy: 'type',
  setColorBy: (colorBy) => set({ colorBy }),

  parking: {},
  setParking: (unit, bay) => {
    const parking = { ...get().parking };
    if (bay) parking[unit] = bay;
    else delete parking[unit];
    set({ parking });
  },

  garageSelection: null,
  setGarageSelection: (garageSelection) => set({ garageSelection }),
  parkingFor: null,
  setParkingFor: (parkingFor) => set({ parkingFor }),

  manifest: null,
  setManifest: (manifest) => set({ manifest }),
  panoActive: false,
  setPanoActive: (panoActive) => set({ panoActive }),
  fittings: { partition: false },
  setFitting: (key, on) => set({ fittings: { ...get().fittings, [key]: on } }),
  planMode: false,
  setPlanMode: (planMode) => set({ planMode }),
  povFade: false,
  setPovFade: (povFade) => set({ povFade }),
  flyTarget: null,
  flyTo: (pos) => set({ flyTarget: { pos, tick: Date.now() } }),
  resetTick: 0,
  resetView: () => set({ resetTick: get().resetTick + 1 }),

  toast: null,
  showToast: (text) => set({ toast: { text, tick: Date.now() } }),

  sceneReady: false,
  setSceneReady: () => set({ sceneReady: true }),
}));

let routeChangedAt = -Infinity;
// Every route change counts, whether from navigate, the address bar or a direct setState.
useAppStore.subscribe((s, prev) => {
  if (s.route !== prev.route) routeChangedAt = performance.now();
});

/** performance.now() of the last route change, so frame-rate checks can discount transition frames. */
export const lastRouteChange = (): number => routeChangedAt;
