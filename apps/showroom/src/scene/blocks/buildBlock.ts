// Turns a BlockDef into render geometry: one repeated typical storey, a void deck and a roof.
// Everything comes from the plan data, so another building only needs new data files.
import type * as THREE from 'three';
import type { BlockDef, PlanBox, Vec2 } from '@bair/project-data';
import {
  CEILING_H,
  planToLocal,
  roofY,
  STOREY_H,
  unitEdges,
  unitXform,
  VOID_DECK_H,
  type PlanEdge,
  type UnitXform,
} from '@bair/project-data';
import { BatchSet, type MeshBatch } from './meshBatch';

export type FacadeMat =
  | 'panelLight'
  | 'panelMid'
  | 'bronze'
  | 'warm'
  | 'teal'
  | 'gold'
  | 'frame'
  | 'slab'
  | 'lamp'
  | 'concrete'
  | 'roofGreen'
  | 'glassShop';

export interface WindowInstance {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  nx: number;
  nz: number;
}

export interface BuiltBlock {
  storey: [FacadeMat, THREE.BufferGeometry][];
  ground: [FacadeMat, THREE.BufferGeometry][];
  roof: [FacadeMat, THREE.BufferGeometry][];
  windows: WindowInstance[];
  /** Oriented boxes around each flat, for picking and highlights. */
  footprints: { center: Vec2; size: Vec2; rotY: number; stack: number }[];
  roofPlants: [number, number, number][];
  liftCore: { center: Vec2; size: Vec2; rotY: number };
}

const H = STOREY_H;
const REVEAL = 0.2;
const FRAME = 0.055;

interface PlacedEdge extends PlanEdge {
  pa: Vec2;
  pb: Vec2;
  pn: Vec2;
  unit: number;
  party: boolean;
  front: boolean;
}

const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
const len = (a: Vec2) => Math.hypot(a[0], a[1]);
const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** True where an outside wall faces another flat's outside wall across a small gap. */
function markParty(edges: PlacedEdge[]) {
  for (const e of edges) {
    const d = sub(e.pb, e.pa);
    const L = len(d);
    if (L < 0.3) continue;
    const t: Vec2 = [d[0] / L, d[1] / L];
    for (const f of edges) {
      if (f.unit === e.unit || dot(e.pn, f.pn) > -0.95) continue;
      const gap = dot(sub(f.pa, e.pa), e.pn);
      if (gap < -0.2 || gap > 0.8) continue;
      const s0 = dot(sub(f.pa, e.pa), t);
      const s1 = dot(sub(f.pb, e.pa), t);
      const lo = Math.max(0, Math.min(s0, s1));
      const hi = Math.min(L, Math.max(s0, s1));
      if (hi - lo > L * 0.45) {
        e.party = true;
        break;
      }
    }
  }
}

function buildWindow(
  set: BatchSet<FacadeMat>,
  a: Vec2,
  b: Vec2,
  n: Vec2,
  sill: number,
  head: number,
  out: WindowInstance[],
  louver: boolean,
  spandrelMat: FacadeMat,
) {
  const lintel = set.get('panelLight');
  const jamb = set.get('panelMid');
  const frame = set.get('frame');
  const d = sub(b, a);
  const L = len(d);
  const t: Vec2 = [d[0] / L, d[1] / L];
  const rotY = Math.atan2(n[0], n[1]);
  const back = (p: Vec2, o: number): Vec2 => [p[0] - n[0] * o, p[1] - n[1] * o];

  // Spandrel below, sits slightly back from the wall face
  set.get(spandrelMat).wall(a, b, n, 0, sill, -0.03);
  lintel.wall(a, b, n, head, H, 0);
  // Reveals give the opening real depth
  jamb.flat([a, b, back(b, REVEAL), back(a, REVEAL)], sill, true);
  jamb.flat([a, b, back(b, REVEAL), back(a, REVEAL)], head, false);
  jamb.quad(
    [a[0], sill, a[1]],
    [back(a, REVEAL)[0], sill, back(a, REVEAL)[1]],
    [back(a, REVEAL)[0], head, back(a, REVEAL)[1]],
    [a[0], head, a[1]],
    [t[0], 0, t[1]],
  );
  jamb.quad(
    [b[0], sill, b[1]],
    [back(b, REVEAL)[0], sill, back(b, REVEAL)[1]],
    [back(b, REVEAL)[0], head, back(b, REVEAL)[1]],
    [b[0], head, b[1]],
    [-t[0], 0, -t[1]],
  );

  const midY = (sill + head) / 2;
  const h = head - sill;
  const c = lerp2(a, b, 0.5);
  const inner = back(c, REVEAL - 0.04);

  if (louver) {
    const slats = Math.max(4, Math.round(h / 0.22));
    for (let i = 0; i <= slats; i++) {
      const y = sill + (h * i) / slats;
      frame.box([inner[0], y, inner[1]], [L, 0.03, 0.09], rotY, {});
    }
    const shade = back(c, REVEAL + 0.25);
    set.get('slab').wall(lerp2(a, shade, 0), b, n, sill, head, -(REVEAL + 0.25));
    void shade;
    return;
  }

  // Frame perimeter
  frame.box([inner[0], sill + FRAME / 2, inner[1]], [L, FRAME, 0.08], rotY);
  frame.box([inner[0], head - FRAME / 2, inner[1]], [L, FRAME, 0.08], rotY);
  const pa = back(a, REVEAL - 0.04);
  const pb = back(b, REVEAL - 0.04);
  frame.box(
    [pa[0] + t[0] * FRAME * 0.5, midY, pa[1] + t[1] * FRAME * 0.5],
    [FRAME, h, 0.08],
    rotY,
    { noTop: true, noBottom: true },
  );
  frame.box(
    [pb[0] - t[0] * FRAME * 0.5, midY, pb[1] - t[1] * FRAME * 0.5],
    [FRAME, h, 0.08],
    rotY,
    { noTop: true, noBottom: true },
  );
  // Mullions
  const panes = Math.max(1, Math.round(L / 0.95));
  for (let i = 1; i < panes; i++) {
    const m = lerp2(pa, pb, i / panes);
    frame.box([m[0], midY, m[1]], [FRAME * 0.8, h, 0.07], rotY, { noTop: true, noBottom: true });
  }
  // Transom over the lower fixed light
  if (h > 1.4) frame.box([inner[0], sill + 0.62, inner[1]], [L, FRAME * 0.7, 0.07], rotY);

  const g = back(c, REVEAL);
  out.push({ x: g[0], y: midY, z: g[1], w: L, h, nx: n[0], nz: n[1] });
}

function buildExteriorEdge(
  set: BatchSet<FacadeMat>,
  e: PlacedEdge,
  xf: UnitXform,
  windows: WindowInstance[],
) {
  const L = len(sub(e.pb, e.pa));
  const isSide = Math.abs(e.normal[0]) > 0.5;
  // Long gable walls wrap in bronze, as on the brochure render's tower ends.
  const wallMat: FacadeMat = isSide && L > 3 ? 'bronze' : e.front ? 'panelLight' : 'panelMid';
  const wall = set.get(wallMat);

  // Windows that sit on this edge, as parameters along it
  const openings = xf.layout.windows
    .filter((w) => {
      const onLine =
        Math.abs(e.normal[0]) > 0.5
          ? Math.abs(w.a[0] - e.a[0]) < 0.02 && Math.abs(w.b[0] - e.a[0]) < 0.02
          : Math.abs(w.a[1] - e.a[1]) < 0.02 && Math.abs(w.b[1] - e.a[1]) < 0.02;
      if (!onLine) return false;
      const mid: Vec2 = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
      const axis = Math.abs(e.normal[0]) > 0.5 ? 1 : 0;
      const lo = Math.min(e.a[axis], e.b[axis]);
      const hi = Math.max(e.a[axis], e.b[axis]);
      return mid[axis] > lo && mid[axis] < hi;
    })
    .map((w) => {
      const axis = Math.abs(e.normal[0]) > 0.5 ? 1 : 0;
      const dir = e.b[axis] > e.a[axis] ? 1 : -1;
      const s0 = (w.a[axis] - e.a[axis]) * dir;
      const s1 = (w.b[axis] - e.a[axis]) * dir;
      return { w, s0: Math.min(s0, s1), s1: Math.max(s0, s1) };
    })
    .sort((p, q) => p.s0 - q.s0);

  const at = (s: number) => lerp2(e.pa, e.pb, s / L);
  let cursor = 0;
  for (const { w, s0, s1 } of openings) {
    if (s0 > cursor) wall.wall(at(cursor), at(s0), e.pn, 0, H);
    const fullW1 = w.sill < 0.7;
    buildWindow(
      set,
      at(s0),
      at(s1),
      e.pn,
      w.sill,
      w.head,
      windows,
      !!w.louver,
      fullW1 && e.front ? 'teal' : wallMat,
    );
    cursor = s1;
  }
  if (cursor < L) wall.wall(at(cursor), at(L), e.pn, 0, H);

  // Slab edge: a shallow continuous ledge at each floor line
  const slab = set.get('panelLight');
  slab.wall(e.pa, e.pb, e.pn, -0.1, 0.1, 0.05);
  slab.flat(
    [
      [e.pa[0] + e.pn[0] * 0.05, e.pa[1] + e.pn[1] * 0.05],
      [e.pb[0] + e.pn[0] * 0.05, e.pb[1] + e.pn[1] * 0.05],
      e.pb,
      e.pa,
    ],
    0.1,
    true,
  );
  slab.flat(
    [
      [e.pa[0] + e.pn[0] * 0.05, e.pa[1] + e.pn[1] * 0.05],
      [e.pb[0] + e.pn[0] * 0.05, e.pb[1] + e.pn[1] * 0.05],
      e.pb,
      e.pa,
    ],
    -0.1,
    false,
  );

  // Gold pinstripes on bronze gables
  if (wallMat === 'bronze' && L > 3 && openings.length === 0) {
    const gold = set.get('gold');
    for (const s of [0.28, 0.36]) {
      const p = at(L * s);
      gold.box(
        [p[0] + e.pn[0] * 0.015, H / 2, p[1] + e.pn[1] * 0.015],
        [0.05, H, 0.03],
        Math.atan2(e.pn[0], e.pn[1]),
        { noTop: true, noBottom: true },
      );
    }
  }
}

function buildLedge(set: BatchSet<FacadeMat>, e: PlacedEdge) {
  // Air-con ledge: open parapet with a screen, not a full wall
  const m = set.get('panelLight');
  m.wall(e.pa, e.pb, e.pn, 0, 1.05);
  m.wall(e.pb, e.pa, [-e.pn[0], -e.pn[1]], 0, 1.05, 0.08);
  m.flat(
    [
      e.pa,
      e.pb,
      [e.pb[0] - e.pn[0] * 0.08, e.pb[1] - e.pn[1] * 0.08],
      [e.pa[0] - e.pn[0] * 0.08, e.pa[1] - e.pn[1] * 0.08],
    ],
    1.05,
    true,
  );
  const frame = set.get('frame');
  const L = len(sub(e.pb, e.pa));
  const bars = Math.round(L / 0.5);
  for (let i = 1; i < bars; i++) {
    const p = lerp2(e.pa, e.pb, i / bars);
    frame.box([p[0], 1.05 + 0.45, p[1]], [0.03, 0.9, 0.03], 0, { noTop: true, noBottom: true });
  }
}

function boxOf(b: BlockDef, box: PlanBox) {
  const [x, z] = planToLocal(b, box.at);
  return {
    x,
    z,
    w: box.size[0] / b.plan.pxPerMetre,
    d: box.size[1] / b.plan.pxPerMetre,
    rotY: ((box.rot ?? 0) * Math.PI) / 180,
  };
}

function shaftWalls(batch: MeshBatch, c: { x: number; z: number; w: number; d: number; rotY: number }, y0: number, y1: number) {
  batch.box([c.x, (y0 + y1) / 2, c.z], [c.w, y1 - y0, c.d], c.rotY, { noTop: true, noBottom: true });
}

function buildCorridor(set: BatchSet<FacadeMat>, b: BlockDef) {
  const pts = b.corridor.map((p) => planToLocal(b, p));
  const WIDTH = 2.5;
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    const d = sub(q, p);
    const L = len(d);
    const rotY = Math.atan2(-d[1], d[0]);
    const cx = (p[0] + q[0]) / 2;
    const cz = (p[1] + q[1]) / 2;
    set.get('slab').box([cx, -0.08, cz], [L + 0.4, 0.2, WIDTH], rotY);
    const nrm: Vec2 = [-d[1] / L, d[0] / L];
    for (const s of [1, -1]) {
      const ox = cx + nrm[0] * s * (WIDTH / 2);
      const oz = cz + nrm[1] * s * (WIDTH / 2);
      set.get('panelLight').box([ox, 0.525, oz], [L, 1.05, 0.12], rotY);
    }
    // Corridor ceiling lights, lit at night
    const n = Math.round(L / 7);
    for (let k = 0; k < n; k++) {
      const m = lerp2(p, q, (k + 0.5) / n);
      set.get('lamp').box([m[0], CEILING_H - 0.03, m[1]], [0.9, 0.05, 0.14], rotY, { noTop: true });
    }
  }
  // Bronze screens close the corridor ends, with a pair of gold pinstripes
  const ends: [Vec2, Vec2][] = [
    [pts[0], pts[1]],
    [pts[pts.length - 1], pts[pts.length - 2]],
  ];
  for (const [end, next] of ends) {
    const d = sub(end, next);
    const L = len(d);
    const n: Vec2 = [d[0] / L, d[1] / L];
    const rot = Math.atan2(n[0], n[1]);
    const c: Vec2 = [end[0] + n[0] * 0.2, end[1] + n[1] * 0.2];
    set.get('bronze').box([c[0], H / 2, c[1]], [WIDTH + 0.5, H, 0.2], rot, { noBottom: true, noTop: true });
    const t: Vec2 = [-n[1], n[0]];
    for (const o of [-0.55, 0.55]) {
      set.get('gold').box(
        [c[0] + n[0] * 0.11 + t[0] * o, H / 2, c[1] + n[1] * 0.11 + t[1] * o],
        [0.05, H, 0.03],
        rot,
        { noBottom: true, noTop: true },
      );
    }
  }
}

export function buildBlock(b: BlockDef): BuiltBlock {
  const storey = new BatchSet<FacadeMat>();
  const ground = new BatchSet<FacadeMat>();
  const roof = new BatchSet<FacadeMat>();
  const windows: WindowInstance[] = [];
  const footprints: BuiltBlock['footprints'] = [];
  const roofPlants: [number, number, number][] = [];

  const xforms = b.stacks.map((s) => unitXform(b, s));
  const placed: PlacedEdge[] = [];

  xforms.forEach((xf, i) => {
    const edges = unitEdges(xf.layout);
    // Walls facing the ledge count as outside walls
    const ledgeBack = edges.interior
      .filter((e) => e.room === 'acLedge' || e.other === 'acLedge')
      .map((e): PlanEdge => {
        if (e.other === 'acLedge') return { ...e, other: null };
        return {
          a: e.b,
          b: e.a,
          room: e.other!,
          other: null,
          normal: [-e.normal[0], -e.normal[1]],
        };
      });
    for (const e of [...edges.exterior, ...ledgeBack]) {
      const pn = xf.dir(e.normal[0], e.normal[1]);
      placed.push({
        ...e,
        pa: xf.point(e.a[0], e.a[1]),
        pb: xf.point(e.b[0], e.b[1]),
        pn,
        unit: i,
        party: false,
        front: e.normal[1] < -0.5,
      });
    }
    footprints.push({
      center: xf.center,
      size: [xf.layout.width, xf.layout.depth],
      rotY: xf.rotY,
      stack: b.stacks[i].stack,
    });
  });
  markParty(placed);

  // ---------- Typical storey ----------
  for (const e of placed) {
    const xf = xforms[e.unit];
    if (e.party) continue;
    if (e.room === 'acLedge') buildLedge(storey, e);
    else buildExteriorEdge(storey, e, xf, windows);
  }

  // Bronze fins where two flats meet: the thick party-wall piers on the plan
  const finSeen = new Set<string>();
  for (const e of placed) {
    if (!e.party) continue;
    const xf = xforms[e.unit];
    const onFront = Math.min(e.a[1], e.b[1]) < 1.1;
    const sideways = Math.abs(e.normal[0]) > 0.5;
    if (!sideways) continue;
    const L = len(sub(e.pb, e.pa));
    // Fill the gap between the two flats
    const c = lerp2(e.pa, e.pb, 0.5);
    const rotY = Math.atan2(e.pn[0], e.pn[1]);
    storey.get('slab').box([c[0] + e.pn[0] * 0.2, H / 2, c[1] + e.pn[1] * 0.2], [L, H, 0.45], rotY, {
      noTop: true,
      noBottom: true,
    });
    if (!onFront) continue;
    const endA = e.a[1] < e.b[1] ? e.pa : e.pb;
    const front = xf.dir(0, -1);
    const key = `${Math.round((endA[0] + e.pn[0] * 0.15) * 2)},${Math.round((endA[1] + e.pn[1] * 0.15) * 2)}`;
    if (finSeen.has(key)) continue;
    finSeen.add(key);
    const finC: Vec2 = [endA[0] + e.pn[0] * 0.17 + front[0] * 0.2, endA[1] + e.pn[1] * 0.17 + front[1] * 0.2];
    const frot = Math.atan2(front[0], front[1]);
    storey.get('bronze').box([finC[0], H / 2, finC[1]], [1.5, H, 0.6], frot, { noBottom: true, noTop: true });
    const g: Vec2 = [finC[0] + front[0] * 0.31, finC[1] + front[1] * 0.31];
    const side: Vec2 = [e.pn[0], e.pn[1]];
    for (const o of [-0.35, 0.35]) {
      storey.get('gold').box(
        [g[0] + side[0] * o, H / 2, g[1] + side[1] * o],
        [0.05, H, 0.03],
        frot,
        { noTop: true, noBottom: true },
      );
    }
  }

  // Pilasters on room partitions: warm accent on the middle one, light on the rest
  xforms.forEach((xf) => {
    if (xf.layout.width < 9) return;
    const parts = unitEdges(xf.layout)
      .interior.filter((e) => Math.abs(e.normal[0]) > 0.5 && Math.min(e.a[1], e.b[1]) < 0.01)
      .map((e) => e.a[0])
      .sort((p, q) => p - q);
    const middle = parts[Math.floor(parts.length / 2)];
    for (const x of parts) {
      const p = xf.point(x, 0);
      const front = xf.dir(0, -1);
      const rot = Math.atan2(front[0], front[1]);
      const warm = x === middle;
      const w = warm ? 1.0 : 0.5;
      const proud = warm ? 0.28 : 0.16;
      const c: Vec2 = [p[0] + (front[0] * proud) / 2, p[1] + (front[1] * proud) / 2];
      storey
        .get(warm ? 'warm' : 'panelLight')
        .box([c[0], H / 2, c[1]], [w, H, proud], rot, { noBottom: true, noTop: true });
    }
  });

  // Soffits and floor plates, so recesses look solid from any angle
  xforms.forEach((xf) => {
    for (const r of xf.layout.rooms) {
      for (const [x0, z0, x1, z1] of r.rects) {
        const pts: [Vec2, Vec2, Vec2, Vec2] = [
          xf.point(x0, z0),
          xf.point(x1, z0),
          xf.point(x1, z1),
          xf.point(x0, z1),
        ];
        storey.get('slab').flat(pts, -0.1, false);
        storey.get('slab').flat(pts, r.room === 'acLedge' ? 0.08 : 0.02, true);
      }
    }
  });

  buildCorridor(storey, b);

  const core = boxOf(b, b.liftCore);
  shaftWalls(storey.get('bronze'), core, 0, H);
  for (const s of b.stairs) {
    const c = boxOf(b, s);
    shaftWalls(storey.get('panelMid'), c, 0, H);
    // Louvred stair windows on the long sides, bronze return on the ends
    for (const side of [-1, 1]) {
      const px = c.x + (side * (c.w / 2 + 0.03));
      storey.get('frame').box([px, 1.45, c.z], [0.06, 1.7, Math.min(c.d - 1.2, 2.2)], 0);
    }
    for (const side of [-1, 1]) {
      storey.get('bronze').box([c.x, H / 2, c.z + side * (c.d / 2 + 0.05)], [c.w + 0.2, H, 0.1], 0, { noTop: true, noBottom: true });
    }
  }

  // ---------- Void deck ----------
  const COL_H = VOID_DECK_H;
  const col = ground.get('concrete');
  xforms.forEach((xf) => {
    const { width, depth } = xf.layout;
    const nx = Math.max(2, Math.round(width / 4.4));
    for (let i = 0; i <= nx; i++) {
      for (const lz of [0.5, Math.min(depth - 0.6, 6.4)]) {
        const p = xf.point((width * i) / nx, lz);
        col.box([p[0], COL_H / 2, p[1]], [0.55, COL_H, 0.95], xf.rotY, { noBottom: true });
      }
    }
    // Plates under each flat
    for (const r of xf.layout.rooms) {
      for (const [x0, z0, x1, z1] of r.rects) {
        ground.get('slab').flat(
          [xf.point(x0, z0), xf.point(x1, z0), xf.point(x1, z1), xf.point(x0, z1)],
          0.04,
          true,
        );
      }
    }
  });
  shaftWalls(ground.get('bronze'), core, 0, COL_H);
  for (const s of b.stairs) shaftWalls(ground.get('panelMid'), boxOf(b, s), 0, COL_H);

  if (b.groundFacility) {
    for (const stack of b.groundFacility.stacks) {
      const i = b.stacks.findIndex((s) => s.stack === stack);
      const xf = xforms[i];
      const { width } = xf.layout;
      const a = xf.point(0, 0.35);
      const c = xf.point(width, 0.35);
      const n = xf.dir(0, -1);
      ground.get('glassShop').wall(a, c, n, 0.05, COL_H - 0.3);
      ground.get('warm').wall(a, c, n, COL_H - 0.3, COL_H, 0.03);
    }
  }

  // ---------- Roof ----------
  const top = roofY(b);
  for (const e of placed) {
    if (e.party) continue;
    const isLedge = e.room === 'acLedge';
    const height = isLedge ? 1.1 : e.front ? 2.5 : 1.5;
    const mat: FacadeMat = e.front ? 'bronze' : 'panelMid';
    const m = roof.get(mat);
    m.wall(e.pa, e.pb, e.pn, top, top + height);
    const inner: Vec2 = [-e.pn[0], -e.pn[1]];
    m.wall(e.pb, e.pa, inner, top, top + height, 0.25);
    m.flat(
      [
        e.pa,
        e.pb,
        [e.pb[0] - e.pn[0] * 0.25, e.pb[1] - e.pn[1] * 0.25],
        [e.pa[0] - e.pn[0] * 0.25, e.pa[1] - e.pn[1] * 0.25],
      ],
      top + height,
      true,
    );
    if (e.front && !isLedge) {
      const L = len(sub(e.pb, e.pa));
      const rot = Math.atan2(e.pn[0], e.pn[1]);
      const c = lerp2(e.pa, e.pb, 0.5);
      roof.get('gold').box(
        [c[0] + e.pn[0] * 0.02, top + height - 0.25, c[1] + e.pn[1] * 0.02],
        [L, 0.05, 0.04],
        rot,
        { noBottom: true },
      );
    }
  }
  xforms.forEach((xf) => {
    for (const r of xf.layout.rooms) {
      for (const [x0, z0, x1, z1] of r.rects) {
        const pts: [Vec2, Vec2, Vec2, Vec2] = [
          xf.point(x0, z0),
          xf.point(x1, z0),
          xf.point(x1, z1),
          xf.point(x0, z1),
        ];
        roof.get('roofGreen').flat(pts, top + 0.12, true);
        roof.get('slab').flat(pts, top, false);
      }
    }
    // Planting scattered over the roof garden
    const { width, depth } = xf.layout;
    const count = Math.round((width * depth) / 7);
    for (let i = 0; i < count; i++) {
      const u = 0.1 + 0.8 * (((i * 7919) % 97) / 97);
      const v = 0.08 + 0.55 * (((i * 104729) % 89) / 89);
      const p = xf.point(width * u, depth * v);
      roofPlants.push([p[0], top + 0.12, p[1]]);
    }
  });
  // Lift overrun, water tanks and services
  shaftWalls(roof.get('bronze'), core, top, top + 5.5);
  roof.get('panelMid').box([core.x, top + 5.6, core.z], [core.w + 0.3, 0.2, core.d + 0.3], core.rotY);
  roof.get('panelMid').box([core.x - 7, top + 1.4, core.z + 1], [4, 2.8, 2.4], core.rotY);
  roof.get('panelMid').box([core.x + 7, top + 1.4, core.z - 1], [4, 2.8, 2.4], core.rotY);
  for (const s of b.stairs) {
    const c = boxOf(b, s);
    shaftWalls(roof.get('panelMid'), c, top, top + 3);
    roof.get('panelLight').box([c.x, top + 3.05, c.z], [c.w + 0.2, 0.12, c.d + 0.2], c.rotY);
  }
  // Corridor roofs
  const cp = b.corridor.map((p) => planToLocal(b, p));
  for (let i = 0; i < cp.length - 1; i++) {
    const d = sub(cp[i + 1], cp[i]);
    const c = lerp2(cp[i], cp[i + 1], 0.5);
    roof.get('slab').box([c[0], top + 0.05, c[1]], [len(d) + 0.4, 0.2, 2.8], Math.atan2(-d[1], d[0]));
  }

  return {
    storey: storey.toGeometries(),
    ground: ground.toGeometries(),
    roof: roof.toGeometries(),
    windows,
    footprints,
    roofPlants,
    liftCore: { center: [core.x, core.z], size: [core.w, core.d], rotY: core.rotY },
  };
}
