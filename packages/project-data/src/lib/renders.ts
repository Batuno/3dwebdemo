// The rendered images a project may have, and how the web app picks between them. Pure, no three.js.
export interface PanoramaFile {
  full: string;
  /** Small version shown while the full one loads. */
  low?: string;
}

export interface RenderManifest {
  version: 1;
  /** Files are relative to this manifest's folder. */
  panoramas: Record<string, Record<string, PanoramaFile>>;
  stills: Record<string, Record<string, string>>;
  /** Keyed `<unitType>` or `<unitType>_mirror`. */
  topviews: Record<string, { day?: string; evening?: string; master?: string }>;
}

export const interiorRenderKey = (unitType: string, spot: string): string => `${unitType}_${spot}`;
export const outdoorRenderKey = (spot: string): string => `outdoor_${spot}`;

/** 1125 → "1845" */
export const renderTimeKey = (minutes: number): string => {
  const m = Math.round(minutes);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`;
};

const toMinutes = (key: string): number => Number(key.slice(0, 2)) * 60 + Number(key.slice(2));

export interface RenderBlend {
  from: string;
  to: string;
  /** 0 shows `from`, 1 shows `to`. */
  t: number;
}

/** The two rendered times around a clock time. Outside the rendered range it holds the nearest one. */
export function renderBlend(times: string[], minutes: number): RenderBlend | null {
  if (times.length === 0) return null;
  const sorted = [...times].sort((a, b) => toMinutes(a) - toMinutes(b));
  if (minutes <= toMinutes(sorted[0])) return { from: sorted[0], to: sorted[0], t: 0 };
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = toMinutes(sorted[i]);
    const b = toMinutes(sorted[i + 1]);
    if (minutes <= b) return { from: sorted[i], to: sorted[i + 1], t: (minutes - a) / (b - a) };
  }
  const last = sorted[sorted.length - 1];
  return { from: last, to: last, t: 0 };
}

/** Accepts only what the viewer can use, so a bad file falls back to real-time rendering. */
export function parseRenderManifest(value: unknown): RenderManifest | null {
  const m = value as Partial<RenderManifest> | null;
  if (!m || m.version !== 1 || typeof m.panoramas !== 'object' || m.panoramas === null) return null;
  return { version: 1, panoramas: m.panoramas, stills: m.stills ?? {}, topviews: m.topviews ?? {} };
}
