import * as THREE from 'three';
import type { Vec2 } from '@bair/project-data';

type V3 = [number, number, number];

/** Collects quads and boxes into one BufferGeometry. UVs are in metres. */
export class MeshBatch {
  private pos: number[] = [];
  private nor: number[] = [];
  private uv: number[] = [];
  private idx: number[] = [];

  /** Quad with an explicit outward normal; the winding is fixed up to match it. */
  quad(a: V3, b: V3, c: V3, d: V3, n: V3) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    const start = this.pos.length / 3;
    const horizontal = Math.abs(n[1]) > 0.5;
    // Tangent along the wall so panel joints follow the facade whatever its angle.
    const tx = -n[2];
    const tz = n[0];
    for (const p of [a, b, c, d]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      if (horizontal) this.uv.push(p[0], p[2]);
      else this.uv.push(p[0] * tx + p[2] * tz, p[1]);
    }
    if (flip) this.idx.push(start, start + 2, start + 1, start, start + 3, start + 2);
    else this.idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }

  /** Axis-aligned box, optionally rotated around Y through its centre. Skips the bottom if asked. */
  box(c: V3, s: V3, rotY = 0, opts: { noBottom?: boolean; noTop?: boolean } = {}) {
    const hx = s[0] / 2;
    const hy = s[1] / 2;
    const hz = s[2] / 2;
    const cs = Math.cos(rotY);
    const sn = Math.sin(rotY);
    const P = (x: number, y: number, z: number): V3 => [
      c[0] + x * cs + z * sn,
      c[1] + y,
      c[2] - x * sn + z * cs,
    ];
    const N = (x: number, z: number): V3 => [x * cs + z * sn, 0, -x * sn + z * cs];
    this.quad(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), N(0, 1));
    this.quad(P(hx, -hy, -hz), P(-hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz), N(0, -1));
    this.quad(P(hx, -hy, hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), N(1, 0));
    this.quad(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), N(-1, 0));
    if (!opts.noTop) {
      this.quad(P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), P(-hx, hy, -hz), [0, 1, 0]);
    }
    if (!opts.noBottom) {
      this.quad(P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz), [0, -1, 0]);
    }
  }

  /** Vertical wall between two plan points. */
  wall(a: Vec2, b: Vec2, n: Vec2, y0: number, y1: number, offset = 0) {
    const ax = a[0] + n[0] * offset;
    const az = a[1] + n[1] * offset;
    const bx = b[0] + n[0] * offset;
    const bz = b[1] + n[1] * offset;
    this.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], [n[0], 0, n[1]]);
  }

  /** Horizontal rectangle from four plan points. */
  flat(pts: [Vec2, Vec2, Vec2, Vec2], y: number, up = true) {
    const [a, b, c, d] = pts;
    this.quad([a[0], y, a[1]], [b[0], y, b[1]], [c[0], y, c[1]], [d[0], y, d[1]], [0, up ? 1 : -1, 0]);
  }

  /** Round tube between two points, smooth normals. */
  tube(a: V3, b: V3, r: number, seg = 8, r2 = r) {
    const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const L = Math.hypot(d[0], d[1], d[2]) || 1;
    const t: V3 = [d[0] / L, d[1] / L, d[2] / L];
    const ref: V3 = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const ux = t[1] * ref[2] - t[2] * ref[1];
    const uy = t[2] * ref[0] - t[0] * ref[2];
    const uz = t[0] * ref[1] - t[1] * ref[0];
    const ul = Math.hypot(ux, uy, uz);
    const u: V3 = [ux / ul, uy / ul, uz / ul];
    const v: V3 = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
    const start = this.pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const ang = (i / seg) * Math.PI * 2;
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      const nx = u[0] * c + v[0] * sn;
      const ny = u[1] * c + v[1] * sn;
      const nz = u[2] * c + v[2] * sn;
      this.pos.push(a[0] + nx * r, a[1] + ny * r, a[2] + nz * r);
      this.nor.push(nx, ny, nz);
      this.uv.push((i / seg) * r * 6.28, 0);
      this.pos.push(b[0] + nx * r2, b[1] + ny * r2, b[2] + nz * r2);
      this.nor.push(nx, ny, nz);
      this.uv.push((i / seg) * r * 6.28, L);
    }
    for (let i = 0; i < seg; i++) {
      const p = start + i * 2;
      this.idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
    }
  }

  /** Flat polygon fan, for convex or star-shaped outlines. */
  fan(points: Vec2[], y: number) {
    let cx = 0;
    let cz = 0;
    for (const p of points) {
      cx += p[0];
      cz += p[1];
    }
    cx /= points.length;
    cz /= points.length;
    const start = this.pos.length / 3;
    this.pos.push(cx, y, cz);
    this.nor.push(0, 1, 0);
    this.uv.push(cx, cz);
    for (const p of points) {
      this.pos.push(p[0], y, p[1]);
      this.nor.push(0, 1, 0);
      this.uv.push(p[0], p[1]);
    }
    const n = points.length;
    const area = points.reduce((acc, p, i) => {
      const q = points[(i + 1) % n];
      return acc + (p[0] * q[1] - q[0] * p[1]);
    }, 0);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (area > 0) this.idx.push(start, start + 1 + j, start + 1 + i);
      else this.idx.push(start, start + 1 + i, start + 1 + j);
    }
  }

  /** Flat ribbon along a polyline (paths, kerb lines). */
  ribbon(points: Vec2[], width: number, y: number) {
    const start = this.pos.length / 3;
    points.forEach((p, i) => {
      const a = points[Math.max(0, i - 1)];
      const b = points[Math.min(points.length - 1, i + 1)];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L;
      const nz = dx / L;
      const w = width / 2;
      this.pos.push(p[0] + nx * w, y, p[1] + nz * w, p[0] - nx * w, y, p[1] - nz * w);
      this.nor.push(0, 1, 0, 0, 1, 0);
      this.uv.push(p[0] + nx * w, p[1] + nz * w, p[0] - nx * w, p[1] - nz * w);
    });
    for (let i = 0; i < points.length - 1; i++) {
      const p = start + i * 2;
      this.idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
    }
  }

  get empty() {
    return this.pos.length === 0;
  }

  toGeometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

export class BatchSet<K extends string> {
  batches = new Map<K, MeshBatch>();
  get(k: K): MeshBatch {
    let b = this.batches.get(k);
    if (!b) {
      b = new MeshBatch();
      this.batches.set(k, b);
    }
    return b;
  }
  toGeometries(): [K, THREE.BufferGeometry][] {
    return [...this.batches.entries()]
      .filter(([, b]) => !b.empty)
      .map(([k, b]) => [k, b.toGeometry()]);
  }
}
