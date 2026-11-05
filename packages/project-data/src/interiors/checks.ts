// Clearance rules from Appendix A.5, computed from the geometry rather than declared by the data.
// Pure functions, shared by the Vitest suite and the ?debug=1 overlay.
import type { RoomId } from '../data/types';
import { footprint } from './build';
import { isWallAt, wallPlan } from './plan';
import type { Facing, FurniturePiece, InteriorDoor, InteriorLayout, RoomSpec } from './types';

export interface Violation {
  /** Stable id used to match the documented exceptions. */
  key: string;
  rule: string;
  subject: string;
  required: number;
  actual: number;
}

export interface Box {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

const EPS = 0.002;

export const boxOf = (p: FurniturePiece): Box => {
  const { sx, sz } = footprint(p);
  return { x0: p.x - sx / 2, z0: p.z - sz / 2, x1: p.x + sx / 2, z1: p.z + sz / 2 };
};

const overlaps = (a: Box, b: Box) =>
  a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS && a.z0 < b.z1 - EPS && a.z1 > b.z0 + EPS;

const DIRS: Record<Facing, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const BEHIND: Record<Facing, Facing> = { n: 's', s: 'n', e: 'w', w: 'e' };

/** Free distance from one side of a box until furniture or a wall, across the box's full width. */
export function freeDistance(
  l: InteriorLayout,
  box: Box,
  side: Facing,
  ignore: (p: FurniturePiece) => boolean,
  max = 3,
): number {
  const [dx, dz] = DIRS[side];
  const horizontal = dz !== 0;
  const a0 = horizontal ? box.x0 : box.z0;
  const a1 = horizontal ? box.x1 : box.z1;
  const from = side === 'n' ? box.z0 : side === 's' ? box.z1 : side === 'w' ? box.x0 : box.x1;
  const others = l.furniture.filter((p) => p.blocks && !ignore(p)).map(boxOf);

  // Samples both ends and the middle of the span, so a mirrored flat measures the same.
  const span: number[] = [a0 + 0.01, a1 - 0.01];
  for (let a = a0 + 0.05; a < a1 - 0.03; a += 0.05) span.push(a);
  let best = max;
  for (let d = 0.005; d <= max; d += 0.005) {
    const c = from + (dx + dz) * d;
    const hit = span.some((a) => {
      const x = horizontal ? a : c;
      const z = horizontal ? c : a;
      return isWallAt(l, x, z) || others.some((o) => x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1);
    });
    if (hit) {
      best = d - 0.005;
      break;
    }
  }
  return Math.round(best * 100) / 100;
}

const roomCovers = (l: InteriorLayout, room: RoomId, box: Box): boolean => {
  const rects = l.rooms.find((r) => r.room === room)?.rects ?? [];
  for (let x = box.x0 + 0.01; x < box.x1; x += 0.04) {
    for (let z = box.z0 + 0.01; z < box.z1; z += 0.04) {
      if (!rects.some((r) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3])) return false;
    }
  }
  return true;
};

const WALL_STANDING = new Set<FurniturePiece['kind']>(['mirror', 'artwork', 'wallHooks', 'towelBar', 'grabBar', 'dressingMirror']);

function sector(door: InteriorDoor): { cx: number; cz: number; r: number; dirs: [Facing, Facing] } | null {
  if (door.kind === 'opening' || door.kind === 'sliding') return null;
  const half = door.width / 2;
  const r = door.kind === 'folding' ? half : door.width;
  const hinge = door.hinge === 'min' ? -half : half;
  const cx = door.axis === 'x' ? door.at[0] + hinge : door.at[0];
  const cz = door.axis === 'z' ? door.at[1] + hinge : door.at[1];
  const along: Facing =
    door.axis === 'x' ? (door.hinge === 'min' ? 'e' : 'w') : door.hinge === 'min' ? 's' : 'n';
  return { cx, cz, r, dirs: [door.swing, along] };
}

/**
 * A door's swing as drawn on a plan: the hinge, the leaf's length, and the directions of the closed and open
 * leaf as unit vectors in plan coordinates. Null for openings and sliding doors, which don't swing.
 */
export function doorSwing(
  door: InteriorDoor,
): { cx: number; cz: number; r: number; closed: [number, number]; open: [number, number] } | null {
  const s = sector(door);
  return s && { cx: s.cx, cz: s.cz, r: s.r, open: DIRS[s.dirs[0]], closed: DIRS[s.dirs[1]] };
}

/** Every point a door leaf passes through, sampled every 2 cm. */
export function swingSamples(door: InteriorDoor, plan = sector(door)): [number, number][] {
  if (!plan) return [];
  const [p, q] = plan.dirs.map((f) => DIRS[f]);
  // The folding leaf opens from the wall face, so the sector starts at the surface of the wall.
  const out: [number, number][] = [];
  for (let u = 0.02; u <= plan.r; u += 0.02) {
    for (let v = 0.02; v <= plan.r; v += 0.02) {
      if (u * u + v * v > plan.r * plan.r) continue;
      out.push([plan.cx + p[0] * u + q[0] * v, plan.cz + p[1] * u + q[1] * v]);
    }
  }
  return out;
}

const FIELD_CELL = 0.025;

interface DistanceField {
  nx: number;
  nz: number;
  dist: Float32Array;
}

const fields = new WeakMap<InteriorLayout, DistanceField>();

/** Distance from every floor point to the nearest wall or piece of furniture. */
function distanceField(l: InteriorLayout): DistanceField {
  const hit = fields.get(l);
  if (hit) return hit;
  const nx = Math.ceil(l.width / FIELD_CELL);
  const nz = Math.ceil(l.depth / FIELD_CELL);
  const blockers = l.furniture.filter((p) => p.blocks).map(boxOf);
  const dist = new Float32Array(nx * nz);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = (i + 0.5) * FIELD_CELL;
      const z = (j + 0.5) * FIELD_CELL;
      const blocked = isWallAt(l, x, z) || blockers.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
      dist[i * nz + j] = blocked ? 0 : 1e6;
    }
  }
  const D = FIELD_CELL;
  const Q = D * Math.SQRT2;
  const relax = (i: number, j: number, p: number, q: number, w: number) => {
    if (p < 0 || q < 0 || p >= nx || q >= nz) return;
    const v = dist[p * nz + q] + w;
    if (v < dist[i * nz + j]) dist[i * nz + j] = v;
  };
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      relax(i, j, i - 1, j, D);
      relax(i, j, i, j - 1, D);
      relax(i, j, i - 1, j - 1, Q);
      relax(i, j, i + 1, j - 1, Q);
    }
  }
  for (let i = nx - 1; i >= 0; i--) {
    for (let j = nz - 1; j >= 0; j--) {
      relax(i, j, i + 1, j, D);
      relax(i, j, i, j + 1, D);
      relax(i, j, i + 1, j + 1, Q);
      relax(i, j, i - 1, j + 1, Q);
    }
  }
  const out = { nx, nz, dist };
  fields.set(l, out);
  return out;
}

/** Whether a body of the given width can get from one point to another around walls and furniture. */
export function canPass(l: InteriorLayout, from: [number, number], to: [number, number], width: number): boolean {
  const { nx, nz, dist } = distanceField(l);
  // A cell centre can sit up to half a cell off the true centre line of a gap.
  const need = width / 2 - FIELD_CELL * 0.8;
  const free = (c: number) => dist[c] >= need;
  // Route ends may stand close to a wall: use the nearest cell the body fits in.
  const snap = ([x, z]: [number, number]): number => {
    const ci = Math.floor(x / FIELD_CELL);
    const cj = Math.floor(z / FIELD_CELL);
    const reach = Math.ceil(0.25 / FIELD_CELL);
    let best = -1;
    let bestD = Infinity;
    for (let a = -reach; a <= reach; a++) {
      for (let b = -reach; b <= reach; b++) {
        const p = ci + a;
        const q = cj + b;
        if (p < 0 || q < 0 || p >= nx || q >= nz) continue;
        const d = a * a + b * b;
        if (d < bestD && free(p * nz + q)) {
          best = p * nz + q;
          bestD = d;
        }
      }
    }
    return best;
  };
  const start = snap(from);
  const goal = snap(to);
  if (start < 0 || goal < 0) return false;
  const seen = new Uint8Array(nx * nz);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const c = stack.pop()!;
    if (c === goal) return true;
    const i = Math.floor(c / nz);
    const j = c % nz;
    for (const [p, q] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (p < 0 || q < 0 || p >= nx || q >= nz) continue;
      const n = p * nz + q;
      if (free(n) && !seen[n]) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return false;
}

export function checkLayout(l: InteriorLayout, spec: RoomSpec[]): Violation[] {
  const out: Violation[] = [];
  const add = (rule: string, subject: string, required: number, actual: number) =>
    out.push({ key: `${l.type}|${rule}|${subject}`, rule, subject, required, actual });
  const name = (p: FurniturePiece) => `${p.room}/${p.id}`;

  for (const p of l.furniture) {
    if (WALL_STANDING.has(p.kind) || p.kind === 'tv') continue;
    if (!roomCovers(l, p.room, boxOf(p))) add('inside-room', name(p), 0, 1);
  }

  const solid = l.furniture.filter((p) => p.blocks);
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      if (overlaps(boxOf(solid[i]), boxOf(solid[j]))) add('furniture-overlap', `${name(solid[i])}+${name(solid[j])}`, 0, 1);
    }
  }

  for (const r of spec) {
    const rects = l.rooms.find((q) => q.room === r.room)?.rects ?? [];
    const area = rects.reduce((s, [a, b, c, d]) => s + (c - a) * (d - b), 0);
    const ratio = area / r.area;
    if (ratio < 0.9 || ratio > 1.1) add('room-area', r.room, r.area, Math.round(area * 100) / 100);
  }

  for (const p of l.furniture) {
    const box = boxOf(p);
    const check = (rule: string, side: Facing, min: number, ignore: (o: FurniturePiece) => boolean) => {
      const free = freeDistance(l, box, side, (o) => o === p || ignore(o));
      if (free < min - EPS) add(rule, name(p), min, free);
    };
    const nothing = () => false;
    switch (p.kind) {
      case 'bed': {
        const sideClear = (o: FurniturePiece) => o.kind === 'nightstand';
        const longSides: Facing[] = p.facing === 'e' || p.facing === 'w' ? ['n', 's'] : ['e', 'w'];
        for (const side of p.access === 'both' ? longSides : p.access ? [p.access] : []) {
          check('bed-side', side, 0.6, sideClear);
        }
        break;
      }
      case 'wardrobeSliding':
        check('wardrobe-sliding-front', p.facing, 0.7, nothing);
        break;
      case 'wardrobeHinged':
        check('wardrobe-hinged-front', p.facing, 0.9, nothing);
        break;
      case 'counter':
        check('counter-front', p.facing, 1.0, (o) => o.kind === 'counter');
        break;
      case 'fridge':
        check('fridge-door', p.facing, 0.9, nothing);
        break;
      case 'wc':
        check('wc-front', p.facing, 0.6, nothing);
        break;
      case 'desk': {
        // The pull-out is measured across the chair, not the whole desk.
        const seat = l.furniture.find((o) => o.kind === 'officeChair' && o.room === p.room);
        const span = seat ? boxOf(seat) : box;
        const front = p.facing === 'n' || p.facing === 's'
          ? { ...box, x0: span.x0, x1: span.x1 }
          : { ...box, z0: span.z0, z1: span.z1 };
        const free = freeDistance(l, front, p.facing, (o) => o === p || o.kind === 'officeChair');
        if (free < 0.8 - EPS) add('desk-chair', name(p), 0.8, free);
        break;
      }
      case 'chair':
        check('behind-dining-chair', BEHIND[p.facing], 0.75, (o) => o.kind === 'chair');
        break;
      case 'coffeeTable': {
        const sofa = l.furniture.find((o) => o.kind === 'sofa' && o.room === p.room);
        if (sofa) {
          const gap = Math.max(boxOf(sofa).x0 - box.x1, box.x0 - boxOf(sofa).x1);
          if (gap < 0.4 - EPS || gap > 0.45 + EPS) add('sofa-coffee-table', name(p), 0.4, Math.round(gap * 100) / 100);
        }
        break;
      }
      default:
        break;
    }
  }

  for (const r of l.routes) {
    if (!canPass(l, r.from, r.to, r.width)) add('walking-route', r.id, r.width, 0);
  }

  // Doors: no leaf through furniture or through another leaf.
  const samples = l.doors.map((d) => ({ door: d, pts: swingSamples(d) }));
  for (const { door, pts } of samples) {
    for (const p of solid) {
      const b = boxOf(p);
      if (pts.some(([x, z]) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1)) add('door-furniture', `${door.id}+${name(p)}`, 0, 1);
    }
  }
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      const other = new Set(samples[j].pts.map(([x, z]) => `${Math.round(x / 0.04)},${Math.round(z / 0.04)}`));
      if (samples[i].pts.some(([x, z]) => other.has(`${Math.round(x / 0.04)},${Math.round(z / 0.04)}`))) {
        add('door-door', `${samples[i].door.id}+${samples[j].door.id}`, 0, 1);
      }
    }
  }

  // Doors stand only on walls; a door drawn in a corridor would have room on both of its ends.
  for (const d of l.doors) {
    if (d.kind === 'opening') continue;
    const r = wallPlan(l).doors.find((q) => q.id === d.id)!.rect;
    const thick = d.axis === 'x' ? r[3] - r[1] : r[2] - r[0];
    if (thick < 0.09) add('door-on-wall', d.id, 0.1, Math.round(thick * 100) / 100);
  }

  // Nothing tall may stand in front of a window. Shower glass and a thin drying rack let the light through.
  const TALL = 1.2;
  for (const w of wallPlan(l).windows) {
    const along = w.side === 'n' || w.side === 's';
    const face = w.side === 'n' ? w.rect[3] : w.side === 's' ? w.rect[1] : w.side === 'w' ? w.rect[2] : w.rect[0];
    const from = along ? w.rect[0] : w.rect[1];
    const to = along ? w.rect[2] : w.rect[3];
    for (const p of l.furniture) {
      if (p.kind === 'shower' || p.kind === 'dryingRack' || p.y + p.h <= Math.max(TALL, w.sill)) continue;
      const b = boxOf(p);
      const gap = w.side === 'n' ? b.z0 - face : w.side === 's' ? face - b.z1 : w.side === 'w' ? b.x0 - face : face - b.x1;
      const overlap = Math.min(to, along ? b.x1 : b.z1) - Math.max(from, along ? b.x0 : b.z0);
      if (gap < 0.15 && gap > -0.01 && overlap > 0.05) add('window-blocked', `${w.id}+${name(p)}`, 0, Math.round(overlap * 100) / 100);
    }
  }

  // Every enterable room has a hotspot, each standing clear of walls and furniture and reachable.
  const entrance = l.doors.find((d) => d.kind === 'entrance')!;
  const start: [number, number] = [entrance.at[0], entrance.at[1] - 0.45];
  for (const r of l.rooms) {
    if (r.room === 'acLedge') continue;
    if (!l.hotspots.some((h) => h.room === r.room)) add('room-hotspot', r.room, 1, 0);
  }
  for (const h of l.hotspots) {
    const rects = l.rooms.find((r) => r.room === h.room)?.rects ?? [];
    const inside = rects.some((r) => h.x > r[0] && h.x < r[2] && h.z > r[1] && h.z < r[3]);
    const onFurniture = solid.some((p) => {
      const b = boxOf(p);
      return h.x > b.x0 && h.x < b.x1 && h.z > b.z0 && h.z < b.z1;
    });
    if (!inside) add('hotspot-in-room', h.id, 1, 0);
    if (onFurniture) add('hotspot-clear', h.id, 1, 0);
    if (inside && !onFurniture && !canPass(l, start, [h.x, h.z], 0.45)) add('hotspot-reachable', h.id, 0.45, 0);
  }

  return out;
}
