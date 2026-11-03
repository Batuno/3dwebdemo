// Small authoring helper. Unit files write coordinates from the clear inner corner of the plan and the
// helper adds the external wall, so every number in a unit file reads as a distance on the drawing.
import type { Rect, RoomId, UnitTypeId, Vec2 } from '../data/types';
import type {
  DoorKind,
  Facing,
  Finish,
  FurnitureKind,
  FurniturePiece,
  Hotspot,
  InteriorDoor,
  InteriorLayout,
  InteriorLight,
  InteriorRoom,
  InteriorWindow,
  LightKind,
  WalkRoute,
} from './types';

export const EXTERNAL_WALL = 0.2;
export const CEILING = 2.6;
export const DOOR_HEAD = 2.1;
/** Brochure "W1": three-quarter height window, about 550 mm parapet. */
export const W1 = { sill: 0.55, head: 2.25 };
export const KITCHEN_WINDOW = { sill: 1.05, head: 2.25 };
export const HIGH_WINDOW = { sill: 1.5, head: 2.25 };

const NOT_BLOCKING = new Set<FurnitureKind>([
  'rug',
  'tv',
  'wallShelf',
  'wallCabinet',
  'sink',
  'hob',
  'hood',
  'washer',
  'worktop',
  'dryingRack',
  'mirrorCabinet',
  'towelBar',
  'grabBar',
  'mirror',
  'artwork',
  'wallHooks',
  'deskLamp',
  'dressingMirror',
  'slidingPartition',
]);

export const footprint = (p: Pick<FurniturePiece, 'w' | 'd' | 'facing'>): { sx: number; sz: number } =>
  p.facing === 'n' || p.facing === 's' ? { sx: p.w, sz: p.d } : { sx: p.d, sz: p.w };

interface PieceOptions {
  optional?: boolean;
  y?: number;
  finish?: Finish;
  round?: boolean;
  access?: FurniturePiece['access'];
  blocks?: boolean;
}

export class LayoutBuilder {
  private rooms: InteriorRoom[] = [];
  private doors: InteriorDoor[] = [];
  private windows: InteriorWindow[] = [];
  private furniture: FurniturePiece[] = [];
  private lights: InteriorLight[] = [];
  private hotspots: Hotspot[] = [];
  private routes: WalkRoute[] = [];
  private type: UnitTypeId;

  constructor(type: UnitTypeId) {
    this.type = type;
  }

  room(
    room: RoomId,
    rects: Rect[],
    opts: Pick<InteriorRoom, 'floor' | 'walls'> & Partial<Pick<InteriorRoom, 'accent' | 'tileAccent'>>,
  ) {
    this.rooms.push({ room, rects, ...opts });
    return this;
  }

  door(
    id: string,
    kind: DoorKind,
    at: Vec2,
    axis: 'x' | 'z',
    width: number,
    hinge: 'min' | 'max',
    swing: Facing,
    optional?: boolean,
  ) {
    this.doors.push({ id, kind, at, axis, width, head: DOOR_HEAD, hinge, swing, optional });
    return this;
  }

  /** A doorless passage through a wall. */
  opening(id: string, at: Vec2, axis: 'x' | 'z', width: number) {
    return this.door(id, 'opening', at, axis, width, 'min', 'n');
  }

  window(
    room: RoomId,
    side: Facing,
    from: number,
    to: number,
    heights: { sill: number; head: number },
    curtain: InteriorWindow['curtain'] = 'none',
    louver?: boolean,
  ) {
    this.windows.push({ id: `${room}-${side}-${this.windows.length}`, room, side, from, to, ...heights, curtain, louver });
    return this;
  }

  /** Places a piece by the corner of its footprint nearest the plan origin. */
  put(
    id: string,
    kind: FurnitureKind,
    room: RoomId,
    size: [w: number, d: number, h: number],
    facing: Facing,
    corner: Vec2,
    opts: PieceOptions = {},
  ) {
    const [w, d, h] = size;
    const { sx, sz } = footprint({ w, d, facing });
    this.furniture.push({
      id,
      kind,
      room,
      w,
      d,
      h,
      facing,
      x: corner[0] + sx / 2,
      z: corner[1] + sz / 2,
      y: opts.y ?? 0,
      blocks: opts.blocks ?? !NOT_BLOCKING.has(kind),
      round: opts.round,
      finish: opts.finish,
      access: opts.access,
      optional: opts.optional,
    });
    return this;
  }

  light(kind: LightKind, room: RoomId, x: number, z: number, y: number, k: number) {
    this.lights.push({ kind, room, x, y, z, k });
    return this;
  }

  /** An evenly spaced grid of ceiling lights over one rectangle. */
  downlights(room: RoomId, rect: Rect, nx: number, nz: number, k = 3000, kind: LightKind = 'downlight') {
    const [x0, z0, x1, z1] = rect;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        this.light(kind, room, x0 + ((x1 - x0) * (i + 0.5)) / nx, z0 + ((z1 - z0) * (j + 0.5)) / nz, CEILING - 0.01, k);
      }
    }
    return this;
  }

  spot(id: string, room: RoomId, x: number, z: number, yaw: number, opts: { kind?: Hotspot['kind']; pitch?: number; fov?: number } = {}) {
    this.hotspots.push({ id, room, kind: opts.kind ?? 'room', x, z, yaw, pitch: opts.pitch ?? -4, fov: opts.fov ?? 70 });
    return this;
  }

  route(id: string, from: Vec2, to: Vec2, width = 0.9) {
    this.routes.push({ id, from, to, width });
    return this;
  }

  build(): InteriorLayout {
    const off = EXTERNAL_WALL;
    const shift2 = (p: Vec2): Vec2 => [p[0] + off, p[1] + off];
    const rooms = this.rooms.map((r) => ({
      ...r,
      rects: r.rects.map(([a, b, c, d]): Rect => [a + off, b + off, c + off, d + off]),
    }));
    const xs = rooms.flatMap((r) => r.rects.flatMap((q) => [q[0], q[2]]));
    const zs = rooms.flatMap((r) => r.rects.flatMap((q) => [q[1], q[3]]));
    return {
      type: this.type,
      width: Math.max(...xs) + off,
      depth: Math.max(...zs) + off,
      rooms,
      doors: this.doors.map((d) => ({ ...d, at: shift2(d.at) })),
      windows: this.windows.map((w) => ({ ...w, from: w.from + off, to: w.to + off })),
      furniture: this.furniture.map((p) => ({ ...p, x: p.x + off, z: p.z + off })),
      lights: this.lights.map((l) => ({ ...l, x: l.x + off, z: l.z + off })),
      hotspots: this.hotspots.map((h) => ({ ...h, x: h.x + off, z: h.z + off })),
      routes: this.routes.map((r) => ({ ...r, from: shift2(r.from), to: shift2(r.to) })),
    };
  }
}

const FLIP: Record<Facing, Facing> = { n: 'n', s: 's', e: 'w', w: 'e' };

/** The same flat reflected across its width, as used by mirrored stacks. */
export function mirrorLayout(l: InteriorLayout): InteriorLayout {
  const mx = (x: number) => l.width - x;
  return {
    ...l,
    mirrored: !l.mirrored,
    rooms: l.rooms.map((r) => ({
      ...r,
      rects: r.rects.map(([a, b, c, d]): Rect => [mx(c), b, mx(a), d]),
      accent: r.accent && FLIP[r.accent],
      tileAccent: r.tileAccent && FLIP[r.tileAccent],
    })),
    doors: l.doors.map((d) => ({
      ...d,
      at: [mx(d.at[0]), d.at[1]],
      swing: FLIP[d.swing],
      hinge: d.axis === 'x' ? (d.hinge === 'min' ? 'max' : 'min') : d.hinge,
    })),
    windows: l.windows.map((w) =>
      w.side === 'n' || w.side === 's'
        ? { ...w, from: mx(w.to), to: mx(w.from) }
        : { ...w, side: FLIP[w.side] },
    ),
    furniture: l.furniture.map((p) => ({
      ...p,
      x: mx(p.x),
      facing: FLIP[p.facing],
      access: p.access && p.access !== 'both' ? FLIP[p.access] : p.access,
    })),
    lights: l.lights.map((q) => ({ ...q, x: mx(q.x) })),
    hotspots: l.hotspots.map((h) => ({ ...h, x: mx(h.x), yaw: -h.yaw })),
    routes: l.routes.map((r) => ({ ...r, from: [mx(r.from[0]), r.from[1]], to: [mx(r.to[0]), r.to[1]] })),
  };
}
