import { describe, expect, it } from 'vitest';
import { interiors } from '../interiors';
import { outdoorSpots } from '../data/outdoor';
import { parseRenderManifest, renderBlend, renderTimeKey } from '../lib/renders';
import { camerasJson, hotspotsJson, representativeStack, sunJson, topviewPropsJson } from './unrealData';

describe('hotspots.json', () => {
  const data = hotspotsJson();

  it('lists every interior and outdoor hotspot once', () => {
    const expected = Object.values(interiors).reduce((n, l) => n + l.hotspots.length, 0) + outdoorSpots.length;
    expect(data.hotspots).toHaveLength(expected);
    expect(new Set(data.hotspots.map((h) => h.id)).size).toBe(expected);
  });

  it('keeps window views out of the panoramas', () => {
    const windows = data.hotspots.filter((h) => h.spot.startsWith('window-'));
    expect(windows.length).toBeGreaterThan(0);
    for (const h of windows) expect(h.panorama).toBe(false);
  });

  it('places every unit type on a non-mirrored stack', () => {
    for (const type of Object.keys(interiors)) {
      expect(representativeStack(type).st.mirror).toBe(false);
      expect(data.placements[type].stack).toBe(representativeStack(type).st.stack);
    }
  });

  it('uses unit-length directions', () => {
    for (const h of data.hotspots) {
      expect(Math.hypot(...h.direction)).toBeCloseTo(1, 2);
      expect(Math.hypot(...h.panoramaNorth)).toBeCloseTo(1, 2);
    }
  });
});

describe('sun.json', () => {
  const sun = sunJson(new Date('2026-11-03T04:00:00Z'));
  it('has the default render times, in order', () => {
    expect(sun.times.map((t) => t.time)).toEqual(['07:00', '09:00', '12:00', '15:00', '17:30', '18:45', '21:00']);
    expect(sun.times[0].key).toBe('0700');
  });
  it('has the sun up at noon and down at night', () => {
    expect(sun.times[2].altitude).toBeGreaterThan(50);
    expect(sun.times[6].altitude).toBeLessThan(0);
  });
});

describe('other exports', () => {
  it('names the opening, overview and block cameras', () => {
    const c = camerasJson({ '804A': { pos: [1, 2, 3], target: [0, 0, 0], fov: 34 } });
    expect(Object.keys(c)).toEqual(['opening', 'overview', 'block_804A']);
  });
  it('gives each unit type its plan props', () => {
    expect(Object.keys(topviewPropsJson().units).sort()).toEqual(Object.keys(interiors).sort());
  });
});

describe('render blending', () => {
  const times = ['0700', '0900', '1200'];
  it('finds the two nearest times', () => {
    expect(renderBlend(times, 8 * 60)).toEqual({ from: '0700', to: '0900', t: 0.5 });
    expect(renderBlend(times, 9 * 60)).toEqual({ from: '0700', to: '0900', t: 1 });
  });
  it('holds at both ends', () => {
    expect(renderBlend(times, 6 * 60)).toEqual({ from: '0700', to: '0700', t: 0 });
    expect(renderBlend(times, 21 * 60)).toEqual({ from: '1200', to: '1200', t: 0 });
  });
  it('sorts and survives an empty or single list', () => {
    expect(renderBlend(['1200', '0700'], 12 * 60)?.from).toBe('0700');
    expect(renderBlend([], 600)).toBeNull();
    expect(renderBlend(['0900'], 600)).toEqual({ from: '0900', to: '0900', t: 0 });
  });
  it('formats time keys', () => {
    expect(renderTimeKey(1125)).toBe('1845');
    expect(renderTimeKey(420)).toBe('0700');
  });
});

describe('manifest parsing', () => {
  it('rejects anything unusable', () => {
    expect(parseRenderManifest(null)).toBeNull();
    expect(parseRenderManifest({ version: 2, panoramas: {} })).toBeNull();
    expect(parseRenderManifest({ version: 1 })).toBeNull();
  });
  it('fills in optional sections', () => {
    expect(parseRenderManifest({ version: 1, panoramas: {} })).toEqual({ version: 1, panoramas: {}, stills: {}, topviews: {} });
  });
});
