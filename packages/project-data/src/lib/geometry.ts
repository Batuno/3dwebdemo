// Pure plan geometry: no three.js here, so it can be unit-tested and reused by a backend.
import {
  layouts,
  type BlockDef,
  type RoomId,
  type StackPlacement,
  type UnitLayout,
  type Vec2,
} from '../data';

export const VOID_DECK_H = 3.6;
export const STOREY_H = 2.8;
export const CEILING_H = 2.6;

/** Floor level of a storey. Storey 1 (void deck) is at 0. */
export const storeyY = (storey: number): number =>
  storey <= 1 ? 0 : VOID_DECK_H + (storey - 2) * STOREY_H;

export const roofY = (b: BlockDef): number => storeyY(b.storeys) + STOREY_H;

export const planToLocal = (b: BlockDef, p: Vec2): Vec2 => [
  (p[0] - b.plan.origin[0]) / b.plan.pxPerMetre,
  (p[1] - b.plan.origin[1]) / b.plan.pxPerMetre,
];

export interface UnitXform {
  layout: UnitLayout;
  center: Vec2;
  rotY: number;
  mirror: boolean;
  /** Unit-local → block-local (x, z). */
  point: (lx: number, lz: number) => Vec2;
  /** Unit-local direction → block-local direction. */
  dir: (dx: number, dz: number) => Vec2;
}

export function unitXform(b: BlockDef, s: StackPlacement): UnitXform {
  const layout = layouts[s.type];
  const center = planToLocal(b, s.at);
  const rotY = (s.rot * Math.PI) / 180;
  const c = Math.cos(rotY);
  const sn = Math.sin(rotY);
  const dir = (dx: number, dz: number): Vec2 => {
    const mx = s.mirror ? -dx : dx;
    return [mx * c + dz * sn, -mx * sn + dz * c];
  };
  const point = (lx: number, lz: number): Vec2 => {
    const [x, z] = dir(lx - layout.width / 2, lz - layout.depth / 2);
    return [center[0] + x, center[1] + z];
  };
  return { layout, center, rotY, mirror: s.mirror, point, dir };
}

/* ---------- Walls derived from the room rectangles ---------- */

export interface PlanEdge {
  a: Vec2;
  b: Vec2;
  /** Room on the inner side; null for neither. */
  room: RoomId;
  /** Other side; null = outside the flat. */
  other: RoomId | null;
  /** Outward normal (points from `room` towards `other`). */
  normal: Vec2;
}

export interface UnitEdges {
  exterior: PlanEdge[];
  interior: PlanEdge[];
}

const CELL = 0.05;
const cache = new Map<string, UnitEdges>();

const roomIndex = (layout: UnitLayout) => {
  const nx = Math.round(layout.width / CELL) + 2;
  const nz = Math.round(layout.depth / CELL) + 2;
  const grid = new Int16Array(nx * nz).fill(-1);
  layout.rooms.forEach((r, idx) => {
    for (const [x0, z0, x1, z1] of r.rects) {
      for (let i = Math.round(x0 / CELL); i < Math.round(x1 / CELL); i++) {
        for (let j = Math.round(z0 / CELL); j < Math.round(z1 / CELL); j++) {
          grid[(i + 1) * nz + (j + 1)] = idx;
        }
      }
    }
  });
  return { grid, nx, nz };
};

/** Runs along room-boundary cells and merges them into long straight edges. */
export function unitEdges(layout: UnitLayout): UnitEdges {
  const hit = cache.get(layout.type);
  if (hit) return hit;
  const { grid, nx, nz } = roomIndex(layout);
  const at = (i: number, j: number) => grid[i * nz + j];
  const isOpen = (p: number, q: number) =>
    layout.open.some(
      ([a, b]) =>
        (layout.rooms[p].room === a && layout.rooms[q].room === b) ||
        (layout.rooms[p].room === b && layout.rooms[q].room === a),
    );
  const out: UnitEdges = { exterior: [], interior: [] };

  const emit = (p: number, q: number, a: Vec2, b: Vec2, normal: Vec2) => {
    // p is the side the normal leaves from; q the side it enters.
    if (p < 0 && q < 0) return;
    if (p < 0) {
      out.exterior.push({
        a: b,
        b: a,
        room: layout.rooms[q].room,
        other: null,
        normal: [-normal[0], -normal[1]],
      });
      return;
    }
    if (q < 0) {
      out.exterior.push({ a, b, room: layout.rooms[p].room, other: null, normal });
      return;
    }
    if (isOpen(p, q)) return;
    out.interior.push({
      a,
      b,
      room: layout.rooms[p].room,
      other: layout.rooms[q].room,
      normal,
    });
  };

  // Vertical lines: x = const, normal +x
  for (let i = 1; i < nx; i++) {
    let start = 0;
    for (let j = 1; j <= nz; j++) {
      const same =
        j < nz && at(i - 1, j) === at(i - 1, start) && at(i, j) === at(i, start);
      if (!same) {
        const p = at(i - 1, start);
        const q = at(i, start);
        if (p !== q) {
          const x = (i - 1) * CELL;
          emit(p, q, [x, (start - 1) * CELL], [x, (j - 1) * CELL], [1, 0]);
        }
        start = j;
      }
    }
  }
  // Horizontal lines: z = const, normal +z
  for (let j = 1; j < nz; j++) {
    let start = 0;
    for (let i = 1; i <= nx; i++) {
      const same =
        i < nx && at(i, j - 1) === at(start, j - 1) && at(i, j) === at(start, j);
      if (!same) {
        const p = at(start, j - 1);
        const q = at(start, j);
        if (p !== q) {
          const z = (j - 1) * CELL;
          emit(p, q, [(start - 1) * CELL, z], [(i - 1) * CELL, z], [0, 1]);
        }
        start = i;
      }
    }
  }
  cache.set(layout.type, out);
  return out;
}

/** The room rect with the biggest area: where its label goes. */
export function roomLabelPoint(layout: UnitLayout, room: RoomId): Vec2 | null {
  const shape = layout.rooms.find((r) => r.room === room);
  if (!shape) return null;
  const big = [...shape.rects].sort(
    (p, q) => (q[2] - q[0]) * (q[3] - q[1]) - (p[2] - p[0]) * (p[3] - p[1]),
  )[0];
  return [(big[0] + big[2]) / 2, (big[1] + big[3]) / 2];
}

/** Compass bearing the main windows face, degrees clockwise from true north. */
export function facingDeg(s: StackPlacement, northOffsetDeg: number, rotExtra = 0): number {
  return ((-s.rot + northOffsetDeg * -1 + rotExtra) % 360 + 360) % 360;
}

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'] as const;
export type CompassKey = (typeof COMPASS)[number];
export const compassKey = (deg: number): CompassKey =>
  COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
