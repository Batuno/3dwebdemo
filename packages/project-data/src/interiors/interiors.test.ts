import { describe, expect, it } from 'vitest';
import {
  checkLayout,
  exceptions,
  footprint,
  interiors,
  mirrorLayout,
  mirroredInteriors,
  roomSpecs,
  wallPlan,
} from './index';

const types = Object.keys(interiors);
const variants = types.flatMap((t) => [
  { name: t, layout: interiors[t], type: t },
  { name: `${t} mirrored`, layout: mirroredInteriors[t], type: t },
]);

describe('clearances from Appendix A.5', () => {
  const expected = exceptions.map((e) => e.key).sort();
  it.each(variants)('$name only breaks the documented exceptions', ({ layout, type }) => {
    const found = checkLayout(layout, roomSpecs[type]).map((v) => v.key);
    const mine = expected.filter((k) => k.startsWith(`${type}|`));
    expect([...new Set(found)].sort()).toEqual(mine);
  });
});

describe('mirroring', () => {
  it.each(types)('%s mirrors back onto itself', (t) => {
    const twice = mirrorLayout(mirrorLayout(interiors[t]));
    for (const [a, b] of twice.furniture.map((p, i) => [p, interiors[t].furniture[i]] as const)) {
      expect(a.x).toBeCloseTo(b.x, 6);
      expect(a.facing).toBe(b.facing);
    }
  });
});

describe('furniture sizes are the Appendix A catalogue', () => {
  const size = (t: string, room: string, id: string) => {
    const p = interiors[t].furniture.find((q) => q.room === room && q.id === id)!;
    return [p.w, p.d, p.h];
  };
  it.each([
    ['2RF_T1', 'living', 'sofa', [1.6, 0.85, 0.8]],
    ['2RF_T1', 'bedroom', 'bed', [1.6, 2.05, 1.0]],
    ['2RF_T1', 'bedroom', 'wardrobe', [2.0, 0.6, 2.4]],
    ['2RF_T2', 'living', 'sofa', [1.8, 0.85, 0.8]],
    ['2RF_T2', 'bedroom', 'wardrobe', [1.9, 0.55, 2.4]],
    ['2RF_T2', 'flex', 'desk', [1.2, 0.6, 0.75]],
    ['3R', 'living', 'sofa', [2.1, 0.9, 0.8]],
    ['3R', 'master', 'wardrobe', [1.55, 0.6, 2.4]],
    ['3R', 'kitchenUtility', 'fridge', [0.7, 0.7, 1.85]],
    ['4R', 'master', 'bed', [1.9, 2.1, 1.1]],
    ['4R', 'master', 'wardrobe', [2.15, 0.6, 2.4]],
    ['4R', 'dining', 'dining-table', [1.6, 0.9, 0.75]],
    ['4R', 'living', 'tv-console', [2.0, 0.4, 0.45]],
  ])('%s %s %s', (t, room, id, want) => {
    expect(size(t as string, room as string, id as string)).toEqual(want);
  });
});

describe('doors', () => {
  it.each(types)('%s has one entrance and no door in an open passage', (t) => {
    const l = interiors[t];
    expect(l.doors.filter((d) => d.kind === 'entrance')).toHaveLength(1);
    const corridorDoors = l.doors.filter((d) => d.id === 'corridor' || d.id === 'entry');
    expect(corridorDoors).toHaveLength(0);
  });

  it.each(types)('%s has a real opening in a wall for every door and window', (t) => {
    const plan = wallPlan(interiors[t]);
    for (const d of plan.doors) expect(Math.min(d.rect[2] - d.rect[0], d.rect[3] - d.rect[1])).toBeGreaterThan(0.09);
    for (const w of plan.windows) expect(Math.min(w.rect[2] - w.rect[0], w.rect[3] - w.rect[1])).toBeGreaterThan(0.09);
  });
});

describe('footprints', () => {
  it('swaps width and depth when a piece faces sideways', () => {
    expect(footprint({ w: 2, d: 1, facing: 'e' })).toEqual({ sx: 1, sz: 2 });
    expect(footprint({ w: 2, d: 1, facing: 's' })).toEqual({ sx: 2, sz: 1 });
  });
});
