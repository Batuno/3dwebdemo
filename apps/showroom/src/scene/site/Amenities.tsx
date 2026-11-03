import { useMemo } from 'react';
import * as THREE from 'three';
import { site, type Amenity, type Vec2 } from '@bair/project-data';
import { BatchSet, type MeshBatch } from '../blocks/meshBatch';
import { useMaterials } from '../materials';
import { smoothPath, STREET } from './Ground';

type AMat =
  | 'rubberOrange'
  | 'rubberYellow'
  | 'rubberGreen'
  | 'rubberTeal'
  | 'rubberDark'
  | 'steel'
  | 'paintRed'
  | 'paintYellow'
  | 'paintBlue'
  | 'paintGreen'
  | 'timber'
  | 'bronze'
  | 'white'
  | 'grey'
  | 'courtGreen'
  | 'courtBlue'
  | 'line'
  | 'dark'
  | 'lamp';

const G = STREET.curb + 0.06;

const blob = (cx: number, cz: number, rx: number, rz: number, seed: number, n = 40): Vec2[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r =
      1 + 0.11 * Math.sin(a * 3 + seed) + 0.07 * Math.sin(a * 5 + seed * 2.3) + 0.04 * Math.sin(a * 7 + seed);
    return [cx + Math.cos(a) * rx * r, cz + Math.sin(a) * rz * r];
  });

function bench(set: BatchSet<AMat>, x: number, z: number, rot: number) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  set.get('timber').box([x, G + 0.45, z], [1.8, 0.06, 0.42], rot);
  set.get('timber').box([x - s * 0.2, G + 0.72, z - c * 0.2], [1.8, 0.3, 0.05], rot);
  for (const o of [-0.75, 0.75]) {
    set.get('steel').box([x + c * o, G + 0.22, z - s * o], [0.06, 0.45, 0.4], rot);
  }
}

function playground(set: BatchSet<AMat>, a: Amenity) {
  const [x, z] = a.position;
  const [w, d] = a.size;
  // Poured rubber in overlapping colour fields, as on the brochure render
  set.get('rubberOrange').fan(blob(x, z, w / 2, d / 2, 1.3), G + 0.015);
  set.get('rubberYellow').fan(blob(x - 3.4, z - 2.4, w / 3.4, d / 3.8, 2.1), G + 0.025);
  set.get('rubberGreen').fan(blob(x + 3.6, z + 2.6, w / 3.8, d / 3.6, 4.7), G + 0.03);
  set.get('rubberTeal').fan(blob(x + 4.2, z - 4.2, w / 7, d / 7, 3.1), G + 0.035);

  // Play tower
  const tx = x - 1.5;
  const tz = z - 0.5;
  for (const [ox, oz] of [
    [-1.2, -1.2],
    [1.2, -1.2],
    [1.2, 1.2],
    [-1.2, 1.2],
  ]) {
    set.get('steel').tube([tx + ox, G, tz + oz], [tx + ox, G + 3.3, tz + oz], 0.055);
  }
  set.get('timber').box([tx, G + 1.5, tz], [2.6, 0.08, 2.6]);
  // Pitched roof in two planes
  const roofY = G + 3.3;
  const rm = set.get('paintRed');
  rm.quad([tx - 1.6, roofY, tz - 1.6], [tx + 1.6, roofY, tz - 1.6], [tx, roofY + 1.15, tz], [tx, roofY + 1.15, tz], [0, 0.8, -0.6]);
  rm.quad([tx + 1.6, roofY, tz + 1.6], [tx - 1.6, roofY, tz + 1.6], [tx, roofY + 1.15, tz], [tx, roofY + 1.15, tz], [0, 0.8, 0.6]);
  rm.quad([tx + 1.6, roofY, tz - 1.6], [tx + 1.6, roofY, tz + 1.6], [tx, roofY + 1.15, tz], [tx, roofY + 1.15, tz], [0.6, 0.8, 0]);
  rm.quad([tx - 1.6, roofY, tz + 1.6], [tx - 1.6, roofY, tz - 1.6], [tx, roofY + 1.15, tz], [tx, roofY + 1.15, tz], [-0.6, 0.8, 0]);
  // Guard panels
  set.get('paintYellow').box([tx, G + 2.05, tz - 1.25], [2.4, 0.9, 0.05], 0, {});
  set.get('paintBlue').box([tx - 1.25, G + 2.05, tz], [0.05, 0.9, 2.4]);
  // Slide
  const slide = set.get('paintYellow');
  slide.quad([tx + 1.25, G + 1.55, tz - 0.4], [tx + 1.25, G + 1.55, tz + 0.4], [tx + 4.8, G + 0.25, tz + 0.4], [tx + 4.8, G + 0.25, tz - 0.4], [0.3, 0.9, 0]);
  set.get('paintBlue').box([tx + 3, G + 0.98, tz - 0.42], [3.75, 0.28, 0.04], 0);
  set.get('paintBlue').box([tx + 3, G + 0.98, tz + 0.42], [3.75, 0.28, 0.04], 0);
  // Climbing net rungs
  for (let i = 0; i < 6; i++) {
    set.get('steel').tube([tx - 1.2, G + 0.2 + i * 0.28, tz + 1.3 + (5 - i) * 0.22], [tx + 1.2, G + 0.2 + i * 0.28, tz + 1.3 + (5 - i) * 0.22], 0.025, 6);
  }
  // Swing frame
  const sx = x + 4.5;
  const sz = z + 3;
  const steel = set.get('paintGreen');
  for (const o of [-2.2, 2.2]) {
    steel.tube([sx + o - 0.5, G, sz - 0.9], [sx + o, G + 2.6, sz], 0.05);
    steel.tube([sx + o + 0.5, G, sz + 0.9], [sx + o, G + 2.6, sz], 0.05);
  }
  steel.tube([sx - 2.2, G + 2.6, sz], [sx + 2.2, G + 2.6, sz], 0.05);
  for (const o of [-1, 1]) {
    set.get('steel').tube([sx + o - 0.2, G + 2.58, sz], [sx + o - 0.2, G + 0.55, sz], 0.012, 4);
    set.get('steel').tube([sx + o + 0.2, G + 2.58, sz], [sx + o + 0.2, G + 0.55, sz], 0.012, 4);
    set.get('dark').box([sx + o, G + 0.54, sz], [0.5, 0.04, 0.2]);
  }
  // See-saw and spring riders
  set.get('paintRed').box([x - 5, G + 0.4, z + 4.5], [3, 0.08, 0.3], 0.15);
  set.get('steel').tube([x - 5, G, z + 4.5], [x - 5, G + 0.38, z + 4.5], 0.06);
  for (const [px, pz] of [
    [x + 5.5, z - 5],
    [x - 6.2, z - 5.2],
  ]) {
    set.get('paintBlue').box([px, G + 0.55, pz], [0.75, 0.3, 0.26]);
    set.get('steel').tube([px, G, pz], [px, G + 0.45, pz], 0.05);
  }
  bench(set, x - 8, z + 7.5, 0.4);
  bench(set, x + 8.6, z - 7.3, -2.6);
}

function fitness(set: BatchSet<AMat>, a: Amenity, tone: AMat) {
  const [x, z] = a.position;
  const [w, d] = a.size;
  set.get(tone).fan(blob(x, z, w / 2, d / 2, a.position[0], 28), G + 0.015);
  const col = set.get(a.kind === 'adultFitness' ? 'paintBlue' : 'paintGreen');
  const steel = set.get('steel');
  const spots: Vec2[] = [
    [-2.6, -2],
    [0, -2.3],
    [2.6, -1.8],
    [-2.3, 1.8],
    [0.4, 2],
    [2.8, 1.6],
  ];
  spots.forEach(([ox, oz], i) => {
    const px = x + ox;
    const pz = z + oz;
    col.tube([px, G, pz], [px, G + 1.5, pz], 0.06, 8);
    if (i % 3 === 0) {
      // Air walker
      col.tube([px, G + 1.45, pz], [px + 0.5, G + 1.45, pz], 0.04, 6);
      steel.tube([px + 0.5, G + 1.45, pz + 0.2], [px + 0.5, G + 0.2, pz + 0.3], 0.025, 6);
      steel.tube([px + 0.5, G + 1.45, pz - 0.2], [px + 0.5, G + 0.2, pz - 0.3], 0.025, 6);
      set.get('dark').box([px + 0.5, G + 0.18, pz + 0.3], [0.32, 0.04, 0.14]);
      set.get('dark').box([px + 0.5, G + 0.18, pz - 0.3], [0.32, 0.04, 0.14]);
    } else if (i % 3 === 1) {
      // Chest press seat
      col.tube([px, G + 0.45, pz], [px - 0.5, G + 0.45, pz], 0.05, 6);
      set.get('dark').box([px - 0.55, G + 0.5, pz], [0.38, 0.06, 0.36]);
      set.get('dark').box([px - 0.32, G + 0.85, pz], [0.05, 0.55, 0.32]);
      steel.tube([px, G + 1.4, pz], [px - 0.75, G + 1.1, pz + 0.35], 0.022, 6);
      steel.tube([px, G + 1.4, pz], [px - 0.75, G + 1.1, pz - 0.35], 0.022, 6);
    } else {
      // Tai-chi wheels
      steel.tube([px - 0.25, G + 1.28, pz + 0.3], [px - 0.25, G + 1.28, pz - 0.3], 0.03, 6);
      for (let k = 0; k < 10; k++) {
        const t0 = (k / 10) * Math.PI * 2;
        const t1 = ((k + 1) / 10) * Math.PI * 2;
        for (const sd of [0.32, -0.32]) {
          col.tube(
            [px - 0.25 + Math.cos(t0) * 0.28, G + 1.28 + Math.sin(t0) * 0.28, pz + sd],
            [px - 0.25 + Math.cos(t1) * 0.28, G + 1.28 + Math.sin(t1) * 0.28, pz + sd],
            0.015,
            4,
          );
        }
      }
    }
  });
}

function shelter(set: BatchSet<AMat>, a: Amenity) {
  const [x, z] = a.position;
  const [w, d] = a.size;
  set.get('grey').box([x, G + 0.05, z], [w, 0.12, d]);
  const hx = w / 2 - 0.4;
  const hz = d / 2 - 0.4;
  for (const [ox, oz] of [
    [-hx, -hz],
    [hx, -hz],
    [hx, hz],
    [-hx, hz],
  ]) {
    set.get('timber').box([x + ox, G + 1.4, z + oz], [0.16, 2.8, 0.16]);
  }
  const y0 = G + 2.8;
  const rm = set.get('timber');
  const o = 0.8;
  const peak: [number, number, number] = [x, y0 + 1.3, z];
  const c = (sx: number, sz: number): [number, number, number] => [x + sx * (w / 2 + o), y0, z + sz * (d / 2 + o)];
  rm.quad(c(-1, -1), c(1, -1), peak, peak, [0, 0.8, -0.6]);
  rm.quad(c(1, 1), c(-1, 1), peak, peak, [0, 0.8, 0.6]);
  rm.quad(c(1, -1), c(1, 1), peak, peak, [0.6, 0.8, 0]);
  rm.quad(c(-1, 1), c(-1, -1), peak, peak, [-0.6, 0.8, 0]);
  // Underside
  set.get('grey').flat(
    [
      [x - w / 2 - o, z - d / 2 - o],
      [x + w / 2 + o, z - d / 2 - o],
      [x + w / 2 + o, z + d / 2 + o],
      [x - w / 2 - o, z + d / 2 + o],
    ],
    y0 - 0.02,
    false,
  );
  bench(set, x, z - 1.6, 0);
  bench(set, x, z + 1.6, Math.PI);
}

function court(set: BatchSet<AMat>, a: Amenity) {
  const [x, z] = a.position;
  const [w, d] = a.size;
  const flat = (m: MeshBatch, x0: number, z0: number, x1: number, z1: number, y: number) =>
    m.flat(
      [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ],
      y,
      true,
    );
  flat(set.get('courtGreen'), x - w / 2, z - d / 2, x + w / 2, z + d / 2, G + 0.01);
  const iw = w / 2 - 1.5;
  const id = d / 2 - 1.6;
  flat(set.get('courtBlue'), x - iw, z - id, x + iw, z + id, G + 0.016);
  const line = set.get('line');
  const T = 0.05;
  const ly = G + 0.022;
  flat(line, x - iw, z - id - T, x + iw, z - id + T, ly);
  flat(line, x - iw, z + id - T, x + iw, z + id + T, ly);
  flat(line, x - iw - T, z - id, x - iw + T, z + id, ly);
  flat(line, x + iw - T, z - id, x + iw + T, z + id, ly);
  flat(line, x - iw, z - T, x + iw, z + T, ly);
  // Centre circle and free-throw keys
  const ring = (cz: number, r: number) => {
    for (let i = 0; i < 28; i++) {
      const a0 = (i / 28) * Math.PI * 2;
      const a1 = ((i + 1) / 28) * Math.PI * 2;
      line.ribbon(
        [
          [x + Math.cos(a0) * r, cz + Math.sin(a0) * r],
          [x + Math.cos(a1) * r, cz + Math.sin(a1) * r],
        ],
        0.09,
        ly,
      );
    }
  };
  ring(z, 1.8);
  for (const s of [-1, 1]) {
    const kz = z + s * id;
    const kd = z + s * (id - 5);
    const k = set.get('courtGreen');
    flat(k, x - 2.4, Math.min(kz, kd), x + 2.4, Math.max(kz, kd), ly - 0.002);
    flat(line, x - 2.4 - T, Math.min(kz, kd), x - 2.4 + T, Math.max(kz, kd), ly);
    flat(line, x + 2.4 - T, Math.min(kz, kd), x + 2.4 + T, Math.max(kz, kd), ly);
    flat(line, x - 2.4, kd - T, x + 2.4, kd + T, ly);
    ring(kd, 1.8);
    // Hoop
    const hz = z + s * (id + 0.6);
    set.get('steel').tube([x, G, hz], [x, G + 3.5, hz], 0.075);
    set.get('white').box([x, G + 3.35, hz - s * 0.5], [1.5, 0.95, 0.04]);
    set.get('steel').box([x, G + 3.3, hz - s * 0.25], [0.1, 0.1, 0.5]);
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2;
      const a1 = ((i + 1) / 12) * Math.PI * 2;
      const rz = hz - s * 0.78;
      set.get('paintRed').tube(
        [x + Math.cos(a0) * 0.23, G + 3.05, rz + Math.sin(a0) * 0.23],
        [x + Math.cos(a1) * 0.23, G + 3.05, rz + Math.sin(a1) * 0.23],
        0.014,
        4,
      );
    }
  }
}

function pavilion(set: BatchSet<AMat>, a: Amenity) {
  const [x, z] = a.position;
  const [w, d] = a.size;
  const H = 3.6;
  set.get('grey').box([x, G + 0.06, z], [w, 0.14, d]);
  set.get('bronze').box([x, G + H + 0.18, z], [w + 1.6, 0.36, d + 1.6]);
  set.get('white').flat(
    [
      [x - w / 2 - 0.8, z - d / 2 - 0.8],
      [x + w / 2 + 0.8, z - d / 2 - 0.8],
      [x + w / 2 + 0.8, z + d / 2 + 0.8],
      [x - w / 2 - 0.8, z + d / 2 + 0.8],
    ],
    G + H - 0.01,
    false,
  );
  const nx = 5;
  for (let i = 0; i <= nx; i++) {
    const px = x - w / 2 + 0.5 + ((w - 1) * i) / nx;
    for (const pz of [z - d / 2 + 0.5, z + d / 2 - 0.5]) {
      set.get('bronze').box([px, G + H / 2, pz], [0.28, H, 0.28]);
      set.get('lamp').box([px + 2, G + H - 0.06, pz + (pz > z ? -1.5 : 1.5)], [0.6, 0.05, 0.6], 0, { noTop: true });
    }
  }
  for (let i = 0; i < 4; i++) {
    bench(set, x - w / 2 + 3 + i * 5, z - 2, 0);
    bench(set, x - w / 2 + 3 + i * 5, z + 2, Math.PI);
  }
  // Timber ceiling slats at the edge give the fascia some depth
  set.get('timber').box([x, G + H - 0.12, z], [w + 0.2, 0.08, d + 0.2], 0, { noTop: true });
}

function dropOff(set: BatchSet<AMat>, a: Amenity) {
  const [x, z] = a.position;
  const [w, d] = a.size;
  const H = 4.4;
  set.get('bronze').box([x, G + H + 0.15, z], [w, 0.3, d]);
  set.get('white').flat(
    [
      [x - w / 2, z - d / 2],
      [x + w / 2, z - d / 2],
      [x + w / 2, z + d / 2],
      [x - w / 2, z + d / 2],
    ],
    G + H - 0.01,
    false,
  );
  for (const ox of [-w / 2 + 0.6, w / 2 - 0.6]) {
    for (const oz of [-d / 2 + 0.6, d / 2 - 0.6]) {
      set.get('bronze').box([x + ox, G + H / 2, z + oz], [0.32, H, 0.32]);
    }
  }
  set.get('line').ribbon(
    [
      [x - w / 2, z - 3.2],
      [x + w / 2, z - 3.2],
    ],
    0.12,
    G + 0.04,
  );
  set.get('lamp').box([x, G + H - 0.05, z], [w * 0.5, 0.05, 0.6], 0, { noTop: true });
}

function substation(set: BatchSet<AMat>, a: Amenity) {
  const [x, z] = a.position;
  const [w, d] = a.size;
  const H = 5.2;
  set.get('grey').box([x, G + H / 2, z], [w, H, d]);
  set.get('bronze').box([x, G + H + 0.12, z], [w + 0.5, 0.24, d + 0.5]);
  // Louvred ventilation panels
  for (let i = 0; i < 5; i++) {
    const pz = z - d / 2 + 2.6 + i * ((d - 5.2) / 4);
    for (let k = 0; k < 9; k++) {
      set.get('dark').box([x + w / 2 + 0.02, G + 1.2 + k * 0.28, pz], [0.05, 0.1, 2.2]);
    }
  }
}

function ramp(set: BatchSet<AMat>, a: Amenity) {
  const [x, z] = a.position;
  const [w, d] = a.size;
  const hd = d / 2;
  // Ramp void: dark slope dropping west into the basement from the street
  set.get('dark').flat(
    [
      [x - w / 2, z - hd],
      [x + w / 2, z - hd],
      [x + w / 2, z + hd],
      [x - w / 2, z + hd],
    ],
    G + 0.02,
    true,
  );
  for (const s of [-1, 1]) {
    set.get('grey').box([x, G + 0.55, z + s * (hd + 0.15)], [w, 1.1, 0.3]);
  }
  set.get('grey').box([x - w / 2 - 0.15, G + 1.35, z], [0.3, 2.7, d + 0.6]);
  // Canopy
  set.get('bronze').box([x - w / 2 + 4, G + 3.45, z], [9, 0.25, d + 1]);
  for (const s of [-1, 1]) {
    set.get('bronze').box([x - w / 2 + 8, G + 2.2, z + s * (hd + 0.1)], [0.2, 2.2, 0.2]);
  }
  // Warning stripes at the lip
  for (let i = 0; i < 6; i++) {
    set.get('paintYellow').flat(
      [
        [x + w / 2 + 0.2, z - hd + i * 1.2],
        [x + w / 2 + 0.7, z - hd + i * 1.2],
        [x + w / 2 + 0.7, z - hd + i * 1.2 + 0.6],
        [x + w / 2 + 0.2, z - hd + i * 1.2 + 0.6],
      ],
      G + 0.03,
      true,
    );
  }
}

function linkways(set: BatchSet<AMat>) {
  for (const raw of site.linkways) {
    const pts = smoothPath(raw, 3.5);
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i];
      const q = pts[i + 1];
      const dx = q[0] - p[0];
      const dz = q[1] - p[1];
      const L = Math.hypot(dx, dz);
      const rot = Math.atan2(-dz, dx);
      const cx = (p[0] + q[0]) / 2;
      const cz = (p[1] + q[1]) / 2;
      set.get('bronze').box([cx, G + 2.85, cz], [L + 0.1, 0.14, 3], rot);
      set.get('white').box([cx, G + 2.76, cz], [L + 0.1, 0.03, 2.7], rot, { noTop: true });
      if (i % 2 === 0) {
        const nx = -dz / L;
        const nz = dx / L;
        for (const s of [1.25, -1.25]) {
          set.get('bronze').box([p[0] + nx * s, G + 1.4, p[1] + nz * s], [0.12, 2.8, 0.12], rot);
        }
      }
      if (i % 3 === 0) {
        set.get('lamp').box([cx, G + 2.72, cz], [0.6, 0.04, 0.12], rot, { noTop: true });
      }
    }
  }
}

function buildAmenities() {
  const set = new BatchSet<AMat>();
  for (const a of site.amenities) {
    switch (a.kind) {
      case 'playground':
        playground(set, a);
        break;
      case 'adultFitness':
        fitness(set, a, 'rubberDark');
        break;
      case 'elderlyFitness':
        fitness(set, a, 'rubberGreen');
        break;
      case 'shelter':
        shelter(set, a);
        break;
      case 'hardCourt':
        court(set, a);
        break;
      case 'pavilion':
        pavilion(set, a);
        break;
      case 'dropOff':
        dropOff(set, a);
        break;
      case 'substation':
        substation(set, a);
        break;
      case 'garageEntry':
        ramp(set, a);
        break;
      case 'garden':
        break;
    }
  }
  linkways(set);
  return set.toGeometries();
}

export function Amenities() {
  const lib = useMaterials();
  const geos = useMemo(buildAmenities, []);
  const mats = useMemo<Record<AMat, THREE.Material>>(() => {
    const rubber = (color: string) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.92,
        normalMap: lib.sets.rubber.normalMap,
        roughnessMap: lib.sets.rubber.roughnessMap,
      });
    const paint = (color: string, roughness = 0.45, metalness = 0.1) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const named = <T extends Record<string, THREE.Material>>(o: T): T => {
      for (const [k, m] of Object.entries(o)) if (!m.name) m.name = `M_Amenity_${k}`;
      return o;
    };
    return named({
      rubberOrange: rubber('#d9733a'),
      rubberYellow: rubber('#e6b84a'),
      rubberGreen: rubber('#6f9c54'),
      rubberTeal: rubber('#4c9a96'),
      rubberDark: rubber('#3f4a46'),
      steel: paint('#a8aaac', 0.35, 0.85),
      paintRed: paint('#b8432f'),
      paintYellow: paint('#e2b23c'),
      paintBlue: paint('#2f6ea8'),
      paintGreen: paint('#3f8a5c'),
      timber: new THREE.MeshStandardMaterial({ ...lib.sets.wood, color: '#b08a62', roughness: 0.7 }),
      bronze: lib.facade.bronze,
      white: paint('#ecebe6', 0.8, 0),
      grey: lib.concrete,
      courtGreen: new THREE.MeshStandardMaterial({ color: '#3f8066', roughness: 0.82, normalMap: lib.sets.concrete.normalMap }),
      courtBlue: new THREE.MeshStandardMaterial({ color: '#35718f', roughness: 0.82, normalMap: lib.sets.concrete.normalMap }),
      line: paint('#f0efe8', 0.7, 0),
      dark: paint('#1b1c1d', 0.8, 0),
      lamp: lib.facade.lamp,
    });
  }, [lib]);
  return (
    <group name="Amenities">
      {geos.map(([k, g]) => (
        <mesh key={k} geometry={g} material={mats[k]} castShadow receiveShadow raycast={() => null} />
      ))}
    </group>
  );
}
