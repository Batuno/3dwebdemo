// The outer shell of each unit type, derived from its interior so the two can never disagree.
// Rooms grow to the centre of the walls between them and to the outside of external walls, giving the
// touching rectangles that the facade and floor-plan builders need.
import { EXTERNAL_WALL, interiors } from '../interiors';
import type { InteriorLayout } from '../interiors';
import type { Rect, RoomId, UnitLayout, UnitTypeId, Vec2, WallWindow } from './types';

const SHARED_WALL_MAX = 0.25;

function growRect(rect: Rect, others: Rect[], width: number, depth: number): Rect {
  const [x0, z0, x1, z1] = rect;
  const nearest = (side: 'n' | 's' | 'e' | 'w'): number => {
    let gap = Infinity;
    for (const o of others) {
      if (side === 'n' || side === 's') {
        if (o[0] >= x1 - 0.001 || o[2] <= x0 + 0.001) continue;
        const g = side === 'n' ? z0 - o[3] : o[1] - z1;
        if (g >= -0.001) gap = Math.min(gap, g);
      } else {
        if (o[1] >= z1 - 0.001 || o[3] <= z0 + 0.001) continue;
        const g = side === 'w' ? x0 - o[2] : o[0] - x1;
        if (g >= -0.001) gap = Math.min(gap, g);
      }
    }
    return gap;
  };
  const grow = (side: 'n' | 's' | 'e' | 'w') => {
    const g = nearest(side);
    return g <= SHARED_WALL_MAX ? g / 2 : EXTERNAL_WALL;
  };
  return [
    Math.max(0, x0 - grow('w')),
    Math.max(0, z0 - grow('n')),
    Math.min(width, x1 + grow('e')),
    Math.min(depth, z1 + grow('s')),
  ];
}

function touching(a: Rect, b: Rect): boolean {
  const sameX = Math.abs(a[2] - b[0]) < 0.001 || Math.abs(b[2] - a[0]) < 0.001;
  const sameZ = Math.abs(a[3] - b[1]) < 0.001 || Math.abs(b[3] - a[1]) < 0.001;
  const overlapX = a[0] < b[2] - 0.001 && b[0] < a[2] - 0.001;
  const overlapZ = a[1] < b[3] - 0.001 && b[1] < a[3] - 0.001;
  return (sameX && overlapZ) || (sameZ && overlapX);
}

function toShell(l: InteriorLayout): UnitLayout {
  const all = l.rooms.flatMap((r) => r.rects.map((rect) => ({ room: r.room, rect })));
  const rooms = l.rooms.map((r) => ({
    room: r.room,
    floor: r.floor,
    rects: r.rects.map((rect) =>
      growRect(rect, all.filter((o) => o.room !== r.room).map((o) => o.rect), l.width, l.depth),
    ),
  }));

  const open: [RoomId, RoomId][] = [];
  const addOpen = (a: RoomId, b: RoomId) => {
    if (a !== b && !open.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) open.push([a, b]);
  };
  for (const p of all) for (const q of all) if (touching(p.rect, q.rect)) addOpen(p.room, q.room);
  const roomAt = (x: number, z: number) =>
    all.find(({ rect }) => x > rect[0] && x < rect[2] && z > rect[1] && z < rect[3])?.room;
  for (const d of l.doors) {
    if (d.kind !== 'opening') continue;
    const [x, z] = d.at;
    const a = d.axis === 'x' ? roomAt(x, z - 0.2) : roomAt(x - 0.2, z);
    const b = d.axis === 'x' ? roomAt(x, z + 0.2) : roomAt(x + 0.2, z);
    if (a && b) addOpen(a, b);
  }

  const windows: WallWindow[] = l.windows.map((w) => {
    const shell = rooms.find((r) => r.room === w.room)!;
    const source = l.rooms.find((r) => r.room === w.room)!;
    const mid = (w.from + w.to) / 2;
    const along = w.side === 'n' || w.side === 's';
    const idx = source.rects.findIndex((q) => (along ? q[0] <= mid && mid <= q[2] : q[1] <= mid && mid <= q[3]));
    const r = shell.rects[idx];
    const line = w.side === 'n' ? r[1] : w.side === 's' ? r[3] : w.side === 'w' ? r[0] : r[2];
    const a: Vec2 = along ? [w.from, line] : [line, w.from];
    const b: Vec2 = along ? [w.to, line] : [line, w.to];
    return { a, b, sill: w.sill, head: w.head, louver: w.louver };
  });

  // The floor-plan builder finds a door by the wall line it sits on, so snap to the nearest room edge.
  const shellRects = rooms.flatMap((r) => r.rects);
  const snapToEdge = (d: InteriorLayout['doors'][number]): Vec2 => {
    const [x, z] = d.at;
    const lines =
      d.axis === 'x'
        ? shellRects.filter((r) => r[0] <= x && x <= r[2]).flatMap((r) => [r[1], r[3]])
        : shellRects.filter((r) => r[1] <= z && z <= r[3]).flatMap((r) => [r[0], r[2]]);
    const across = d.axis === 'x' ? z : x;
    const best = lines.reduce((p, q) => (Math.abs(q - across) < Math.abs(p - across) ? q : p), across + 9);
    return d.axis === 'x' ? [x, best] : [best, z];
  };

  return {
    type: l.type,
    width: l.width,
    depth: l.depth,
    rooms,
    open,
    doors: l.doors
      .filter((d) => d.kind !== 'opening')
      .map((d) => ({ at: snapToEdge(d), axis: d.axis, width: d.width, entrance: d.kind === 'entrance' })),
    windows,
  };
}

export const layouts: Record<UnitTypeId, UnitLayout> = Object.fromEntries(
  Object.entries(interiors).map(([k, v]) => [k, toShell(v)]),
);
