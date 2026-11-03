import { describe, expect, it } from 'vitest';
import { blocks } from '../data/blocks';
import { storeyY } from '../lib/geometry';
import { boxOf, interiors, planExtras } from './index';
import { EYE_HEIGHT, headingOnPlan, lineOfSight, spotPose, visibleSpots } from './pov';

const a = blocks[0];
const stack = (n: number) => a.stacks.find((s) => s.stack === n)!;
const types = Object.keys(interiors);

describe('hotspot coverage', () => {
  it.each(types)('%s living room has a whole-room view set and a window view', (t) => {
    const living = interiors[t].hotspots.filter((h) => h.room === 'living');
    expect(living.filter((h) => h.kind === 'room').length).toBeGreaterThanOrEqual(2);
    expect(living.filter((h) => h.kind === 'window')).toHaveLength(1);
  });

  it.each(['3R', '4R'])('%s master bedroom has a window view', (t) => {
    const spots = interiors[t].hotspots.filter((h) => h.room === 'master' && h.kind === 'window');
    expect(spots).toHaveLength(1);
  });

  it.each(types)('%s has unique hotspot ids', (t) => {
    const ids = interiors[t].hotspots.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('camera pose', () => {
  const h = interiors['4R'].hotspots.find((s) => s.id === 'window-living')!;

  it('stands at eye height on the right storey', () => {
    expect(spotPose(a, stack(335), 12, h).pos[1]).toBeCloseTo(storeyY(12) + EYE_HEIGHT);
  });

  it('looks out of the facade the stack faces', () => {
    // Plan north is -z: 335 faces north, 333 south.
    expect(spotPose(a, stack(335), 12, h).dir[2]).toBeLessThan(-0.9);
    expect(spotPose(a, stack(333), 12, h).dir[2]).toBeGreaterThan(0.9);
  });

  it('mirrors a sideways view with the stack', () => {
    const side = interiors['4R'].hotspots.find((s) => s.id === 'living-3')!;
    const plain = stack(337);
    const mirrored = stack(335);
    expect(plain.mirror).toBe(false);
    expect(mirrored.mirror).toBe(true);
    expect(Math.sign(spotPose(a, plain, 12, side).dir[0])).toBe(-Math.sign(spotPose(a, mirrored, 12, side).dir[0]));
  });

  it('reads a view direction back onto the plan', () => {
    for (const n of [335, 333, 339]) {
      const st = stack(n);
      const pose = spotPose(a, st, 12, h);
      const [x, z] = headingOnPlan(a, st, pose.dir[0], pose.dir[2]);
      // The window view is straight at the top of the plan, whichever way the stack is turned.
      expect(x).toBeCloseTo(0, 5);
      expect(z).toBeCloseTo(-1, 5);
    }
  });
});

describe('line of sight', () => {
  const l = interiors['4R'];
  const spot = (id: string) => l.hotspots.find((s) => s.id === id)!;

  it('sees along the open corridor and through a doorway', () => {
    const corridor = spot('corridor-1');
    expect(lineOfSight(l, [corridor.x, corridor.z], [corridor.x - 3, corridor.z])).toBe(true);
    const bed2 = spot('bed2-1');
    expect(lineOfSight(l, [bed2.x, bed2.z], [bed2.x, bed2.z + 1.2])).toBe(true);
  });

  it('stops at walls', () => {
    const a1 = spot('bed2-1');
    const b1 = spot('bed3-1');
    expect(lineOfSight(l, [a1.x, a1.z], [b1.x, b1.z])).toBe(false);
  });

  it.each(types)('%s never lists the standing spot, and every spot sees at least one other', (t) => {
    for (const h of interiors[t].hotspots) {
      const seen = visibleSpots(interiors[t], h);
      expect(seen.some((s) => s.id === h.id)).toBe(false);
    }
    const reachable = interiors[t].hotspots.filter((h) => visibleSpots(interiors[t], h).length > 0);
    expect(reachable.length / interiors[t].hotspots.length).toBeGreaterThan(0.7);
  });
});

describe('plan extras', () => {
  it.each(types)('%s plants and figures stand on floor, clear of furniture', (t) => {
    const l = interiors[t];
    const solid = l.furniture.filter((p) => p.blocks).map(boxOf);
    const points = [...planExtras[t].plants, ...planExtras[t].people.map((p) => p.at)];
    for (const [x, z] of points) {
      const onFloor = l.rooms.some((r) => r.rects.some((q) => x > q[0] && x < q[2] && z > q[1] && z < q[3]));
      expect(onFloor, `${t} ${x},${z} on floor`).toBe(true);
      const hit = solid.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
      expect(hit, `${t} ${x},${z} clear`).toBe(false);
    }
  });
});
