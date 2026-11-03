import { describe, expect, it } from 'vitest';
import { blocks, layouts, unitTypes } from '../data';
import { compassKey, facingDeg, roofY, storeyY, unitEdges, unitXform } from './geometry';

describe('storeys', () => {
  it('stacks floors from the void deck up', () => {
    expect(storeyY(1)).toBe(0);
    expect(storeyY(2)).toBeCloseTo(3.6);
    expect(storeyY(3)).toBeCloseTo(6.4);
    expect(roofY(blocks[0])).toBeCloseTo(3.6 + 23 * 2.8);
  });
});

describe('layouts', () => {
  it('stays close to the brochure internal area for every unit type', () => {
    for (const l of Object.values(layouts)) {
      const area = l.rooms
        .filter((r) => r.room !== 'acLedge')
        .flatMap((r) => r.rects)
        .reduce((s, [a, b, c, d]) => s + (c - a) * (d - b), 0);
      const target = unitTypes[l.type].internalArea;
      expect(Math.abs(area - target) / target).toBeLessThan(0.15);
    }
  });

  it('places each door and window on a wall edge', () => {
    for (const l of Object.values(layouts)) {
      const e = unitEdges(l);
      const edges = [...e.exterior, ...e.interior];
      const onEdge = (x: number, z: number) =>
        edges.some(
          ({ a, b }) =>
            x >= Math.min(a[0], b[0]) - 0.01 &&
            x <= Math.max(a[0], b[0]) + 0.01 &&
            z >= Math.min(a[1], b[1]) - 0.01 &&
            z <= Math.max(a[1], b[1]) + 0.01,
        );
      for (const d of l.doors) {
        expect(onEdge(d.at[0], d.at[1]), `${l.type} door ${d.at}`).toBe(true);
      }
      for (const w of l.windows) {
        expect(onEdge(w.a[0], w.a[1]), `${l.type} window a ${w.a}`).toBe(true);
        expect(onEdge(w.b[0], w.b[1]), `${l.type} window b ${w.b}`).toBe(true);
      }
    }
  });
});

describe('placement', () => {
  it('keeps every stack on the side of the corridor the brief describes', () => {
    const a = blocks[0];
    const z = (stack: number) => unitXform(a, a.stacks.find((s) => s.stack === stack)!).center[1];
    const x = (stack: number) => unitXform(a, a.stacks.find((s) => s.stack === stack)!).center[0];
    expect(z(335)).toBeLessThan(z(333));
    expect(z(337)).toBeLessThan(z(331));
    expect(z(319)).toBeLessThan(z(325));
    expect(z(321)).toBeLessThan(z(323));
    expect(x(335)).toBeLessThan(x(337));
    expect(x(319)).toBeLessThan(x(321));
    expect(x(339)).toBeLessThan(x(317));
    const b = blocks[1];
    const zb = (stack: number) => unitXform(b, b.stacks.find((s) => s.stack === stack)!).center[1];
    expect(zb(347)).toBeLessThan(zb(345));
    expect(zb(351)).toBeLessThan(zb(341));
    expect(zb(355)).toBeLessThan(zb(361));
  });

  it('maps a north-facing unit facade to its north edge, and south-facing to south', () => {
    const a = blocks[0];
    const n = unitXform(a, a.stacks.find((s) => s.stack === 335)!);
    const s = unitXform(a, a.stacks.find((x) => x.stack === 333)!);
    expect(n.point(n.layout.width / 2, 0)[1]).toBeLessThan(n.center[1]);
    expect(s.point(s.layout.width / 2, 0)[1]).toBeGreaterThan(s.center[1]);
  });

  it('mirrors a unit by swapping its living-room end', () => {
    const a = blocks[0];
    const m = unitXform(a, a.stacks.find((s) => s.stack === 335)!); // main bedroom on the west
    const p = unitXform(a, a.stacks.find((s) => s.stack === 337)!); // living room on the west
    expect(m.point(0, 0)[0]).toBeGreaterThan(m.center[0]);
    expect(p.point(0, 0)[0]).toBeLessThan(p.center[0]);
  });
});

describe('compass', () => {
  it('names bearings', () => {
    expect(compassKey(0)).toBe('north');
    expect(compassKey(92)).toBe('east');
    expect(compassKey(359)).toBe('north');
    expect(compassKey(180)).toBe('south');
  });
  it('computes where a stack faces', () => {
    const a = blocks[0];
    const north = a.stacks.find((s) => s.stack === 335)!;
    const south = a.stacks.find((s) => s.stack === 333)!;
    expect(compassKey(facingDeg(north, -10))).toBe('north');
    expect(compassKey(facingDeg(south, -10))).toBe('south');
  });
});
