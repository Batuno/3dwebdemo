// Turns an interior layout into solid walls and wall finishes on a 5 cm grid.
// A cell is wall when it is within the external wall thickness of a room and not inside one.
import type { Rect, RoomId } from '../data/types';
import { CEILING, EXTERNAL_WALL } from './build';
import type { Facing, InteriorLayout } from './types';

const CELL = 0.05;
const toCell = (v: number) => Math.round(v / CELL);

export interface PlanGrid {
  nx: number;
  nz: number;
  /** Room index per cell, -1 for no room. */
  rooms: Int16Array;
  /** 1 where a wall stands, 0 elsewhere. Door and window openings are still wall here. */
  solid: Uint8Array;
}

const cache = new WeakMap<InteriorLayout, PlanGrid>();

export function planGrid(l: InteriorLayout): PlanGrid {
  const hit = cache.get(l);
  if (hit) return hit;
  const nx = toCell(l.width);
  const nz = toCell(l.depth);
  const rooms = new Int16Array(nx * nz).fill(-1);
  l.rooms.forEach((r, idx) => {
    for (const [x0, z0, x1, z1] of r.rects) {
      for (let i = toCell(x0); i < toCell(x1); i++) {
        for (let j = toCell(z0); j < toCell(z1); j++) rooms[i * nz + j] = idx;
      }
    }
  });
  const reach = toCell(EXTERNAL_WALL);
  const solid = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      if (rooms[i * nz + j] >= 0) continue;
      search: for (let a = -reach; a <= reach; a++) {
        for (let b = -reach; b <= reach; b++) {
          const p = i + a;
          const q = j + b;
          if (p >= 0 && q >= 0 && p < nx && q < nz && rooms[p * nz + q] >= 0) {
            solid[i * nz + j] = 1;
            break search;
          }
        }
      }
    }
  }
  const out = { nx, nz, rooms, solid };
  cache.set(l, out);
  return out;
}

/** The wall cells a door or window passes through. */
function openingRect(g: PlanGrid, at: [number, number], axis: 'x' | 'z', width: number): Rect {
  const isSolid = (i: number, j: number) => i >= 0 && j >= 0 && i < g.nx && j < g.nz && g.solid[i * g.nz + j] === 1;
  const ci = Math.floor(at[0] / CELL);
  const cj = Math.floor(at[1] / CELL);
  if (axis === 'x') {
    let lo = cj;
    let hi = cj;
    while (isSolid(ci, lo - 1)) lo--;
    while (isSolid(ci, hi + 1)) hi++;
    return [at[0] - width / 2, lo * CELL, at[0] + width / 2, (hi + 1) * CELL];
  }
  let lo = ci;
  let hi = ci;
  while (isSolid(lo - 1, cj)) lo--;
  while (isSolid(hi + 1, cj)) hi++;
  return [lo * CELL, at[1] - width / 2, (hi + 1) * CELL, at[1] + width / 2];
}

export interface WallBox {
  rect: Rect;
  y0: number;
  y1: number;
}

export interface WindowOpening {
  id: string;
  room: RoomId;
  side: Facing;
  rect: Rect;
  sill: number;
  head: number;
  curtain: 'none' | 'sheer' | 'blackout';
  louver: boolean;
}

export interface DoorOpening {
  id: string;
  rect: Rect;
  head: number;
}

/** A painted or tiled face of a wall, seen from inside a room. */
export interface WallFace {
  room: RoomId;
  side: Facing;
  /** Fixed coordinate of the face, and its span along the wall. */
  line: number;
  from: number;
  to: number;
  y0: number;
  y1: number;
}

export interface WallPlan {
  boxes: WallBox[];
  doors: DoorOpening[];
  windows: WindowOpening[];
  faces: WallFace[];
}

function roomEdgeRect(l: InteriorLayout, g: PlanGrid, w: InteriorLayout['windows'][number]): Rect {
  const roomRects = l.rooms.find((r) => r.room === w.room)!.rects;
  const along = w.side === 'n' || w.side === 's';
  const mid = (w.from + w.to) / 2;
  const owner = roomRects.find((r) => (along ? r[0] <= mid && mid <= r[2] : r[1] <= mid && mid <= r[3]))!;
  const line = w.side === 'n' ? owner[1] : w.side === 's' ? owner[3] : w.side === 'w' ? owner[0] : owner[2];
  const step = w.side === 'n' || w.side === 'w' ? -1 : 1;
  const inWall = line + (step * CELL) / 2;
  const at: [number, number] = along ? [mid, inWall] : [inWall, mid];
  return openingRect(g, at, along ? 'x' : 'z', w.to - w.from);
}

/** Merges solid cells outside `holes` into as few rectangles as a row scan allows. */
function mergeCells(g: PlanGrid, keep: (i: number, j: number) => boolean): Rect[] {
  const used = new Uint8Array(g.nx * g.nz);
  const out: Rect[] = [];
  for (let j = 0; j < g.nz; j++) {
    for (let i = 0; i < g.nx; i++) {
      if (used[i * g.nz + j] || !keep(i, j)) continue;
      let w = 1;
      while (i + w < g.nx && !used[(i + w) * g.nz + j] && keep(i + w, j)) w++;
      let h = 1;
      grow: while (j + h < g.nz) {
        for (let a = 0; a < w; a++) {
          if (used[(i + a) * g.nz + (j + h)] || !keep(i + a, j + h)) break grow;
        }
        h++;
      }
      for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) used[(i + a) * g.nz + (j + b)] = 1;
      out.push([i * CELL, j * CELL, (i + w) * CELL, (j + h) * CELL]);
    }
  }
  return out;
}

const inRect = (r: Rect, x: number, z: number) => x > r[0] && x < r[2] && z > r[1] && z < r[3];

const plans = new WeakMap<InteriorLayout, WallPlan>();

export function wallPlan(l: InteriorLayout): WallPlan {
  const hit = plans.get(l);
  if (hit) return hit;
  const g = planGrid(l);
  const doors: DoorOpening[] = l.doors.map((d) => ({
    id: d.id,
    head: d.head,
    rect: openingRect(g, d.at, d.axis, d.width),
  }));
  const windows: WindowOpening[] = l.windows.map((w) => ({
    id: w.id,
    room: w.room,
    side: w.side,
    rect: roomEdgeRect(l, g, w),
    sill: w.sill,
    head: w.head,
    curtain: w.curtain,
    louver: !!w.louver,
  }));

  const center = (i: number, j: number): [number, number] => [(i + 0.5) * CELL, (j + 0.5) * CELL];
  const holes = [...doors.map((d) => d.rect), ...windows.map((w) => w.rect)];
  const boxes: WallBox[] = mergeCells(g, (i, j) => {
    if (!g.solid[i * g.nz + j]) return false;
    const [x, z] = center(i, j);
    return !holes.some((h) => inRect(h, x, z));
  }).map((rect) => ({ rect, y0: 0, y1: CEILING }));
  for (const d of doors) boxes.push({ rect: d.rect, y0: d.head, y1: CEILING });
  for (const w of windows) {
    boxes.push({ rect: w.rect, y0: 0, y1: w.sill });
    boxes.push({ rect: w.rect, y0: w.head, y1: CEILING });
  }

  return store(l, { boxes, doors, windows, faces: wallFaces(l, g, doors, windows) });
}

function store(l: InteriorLayout, p: WallPlan): WallPlan {
  plans.set(l, p);
  return p;
}

const SIDES: { side: Facing; di: number; dj: number }[] = [
  { side: 'n', di: 0, dj: -1 },
  { side: 's', di: 0, dj: 1 },
  { side: 'w', di: -1, dj: 0 },
  { side: 'e', di: 1, dj: 0 },
];

function wallFaces(l: InteriorLayout, g: PlanGrid, doors: DoorOpening[], windows: WindowOpening[]): WallFace[] {
  const out: WallFace[] = [];
  l.rooms.forEach((r, idx) => {
    const room = r.room;
    for (const { side, di, dj } of SIDES) {
      const along = side === 'n' || side === 's';
      // Walk every grid line of this room and collect runs of cells whose neighbour is a wall.
      const lines = new Map<number, number[]>();
      for (let i = 0; i < g.nx; i++) {
        for (let j = 0; j < g.nz; j++) {
          if (g.rooms[i * g.nz + j] !== idx) continue;
          const p = i + di;
          const q = j + dj;
          if (p < 0 || q < 0 || p >= g.nx || q >= g.nz) continue;
          if (!g.solid[p * g.nz + q]) continue;
          const key = along ? j + (dj > 0 ? 1 : 0) : i + (di > 0 ? 1 : 0);
          (lines.get(key) ?? lines.set(key, []).get(key)!).push(along ? i : j);
        }
      }
      for (const [key, cells] of lines) {
        cells.sort((a, b) => a - b);
        const line = key * CELL;
        // Splits a span around the openings that cross this line, keeping the wall above and below them.
        const emit = (from: number, to: number) => {
          const cuts = [
            ...doors.map((d) => ({ rect: d.rect, y0: 0, y1: d.head })),
            ...windows.map((w) => ({ rect: w.rect, y0: w.sill, y1: w.head })),
          ]
            .filter(({ rect }) => (along ? line >= rect[1] - 0.001 && line <= rect[3] + 0.001 : line >= rect[0] - 0.001 && line <= rect[2] + 0.001))
            .map(({ rect, y0, y1 }) => ({ a: along ? rect[0] : rect[1], b: along ? rect[2] : rect[3], y0, y1 }))
            .filter((c) => c.b > from + 0.001 && c.a < to - 0.001)
            .sort((p, q) => p.a - q.a);
          let cursor = from;
          for (const c of cuts) {
            const a = Math.max(c.a, from);
            const b = Math.min(c.b, to);
            if (a > cursor + 0.001) out.push({ room, side, line, from: cursor, to: a, y0: 0, y1: CEILING });
            if (c.y0 > 0.001) out.push({ room, side, line, from: a, to: b, y0: 0, y1: c.y0 });
            if (c.y1 < CEILING - 0.001) out.push({ room, side, line, from: a, to: b, y0: c.y1, y1: CEILING });
            cursor = Math.max(cursor, b);
          }
          if (to > cursor + 0.001) out.push({ room, side, line, from: cursor, to, y0: 0, y1: CEILING });
        };
        let start = cells[0];
        let prev = cells[0];
        for (const c of cells.slice(1)) {
          if (c !== prev + 1) {
            emit(start * CELL, (prev + 1) * CELL);
            start = c;
          }
          prev = c;
        }
        emit(start * CELL, (prev + 1) * CELL);
      }
    }
  });
  return out;
}

/** Whether a person-sized point can stand here, ignoring furniture. */
export function isWallAt(l: InteriorLayout, x: number, z: number): boolean {
  const g = planGrid(l);
  const i = Math.floor(x / CELL);
  const j = Math.floor(z / CELL);
  if (i < 0 || j < 0 || i >= g.nx || j >= g.nz) return true;
  if (g.rooms[i * g.nz + j] >= 0) return false;
  // Test the cell centre, so a point exactly on a door jamb does not read as solid.
  const cx = (i + 0.5) * CELL;
  const cz = (j + 0.5) * CELL;
  return !wallPlan(l).doors.some((d) => inRect(d.rect, cx, cz));
}
