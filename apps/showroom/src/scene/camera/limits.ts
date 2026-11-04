// Where the orbit camera may go: inside a circle around the site, above the ground, and never inside
// one of the neighbouring buildings. Expressed as the farthest distance from the orbit target along
// the current view line, so camera-controls can stop a zoom-out at the wall instead of bouncing back.
import * as THREE from 'three';
import { contextTowers } from '../site/Context';

/** Horizontal radius, in metres from the site centre, the camera stays within. */
export const SITE_RADIUS = 360;
/** Clearance kept from the neighbouring buildings' walls and roofs. */
const BUILDING_MARGIN = 4;
/** The camera never drops below this height outside the garage. */
export const MIN_CAMERA_Y = 1.2;

interface Box {
  x: number;
  z: number;
  cos: number;
  sin: number;
  hw: number;
  hd: number;
  top: number;
}

let boxes: Box[] | null = null;
function contextBoxes(): Box[] {
  boxes ??= contextTowers().map((t) => ({
    x: t.x,
    z: t.z,
    cos: Math.cos(t.rot),
    sin: Math.sin(t.rot),
    hw: t.w / 2 + BUILDING_MARGIN,
    hd: t.d / 2 + BUILDING_MARGIN,
    top: t.h + BUILDING_MARGIN,
  }));
  return boxes;
}

/** Distance along the ray at which it first enters the box, or Infinity. Slab test in the box's own frame. */
function entry(b: Box, o: THREE.Vector3, d: THREE.Vector3): number {
  // Into the box frame: undo its rotation about y (three rotates x towards -z for positive angles).
  const ox = o.x - b.x;
  const oz = o.z - b.z;
  const lx = ox * b.cos - oz * b.sin;
  const lz = ox * b.sin + oz * b.cos;
  const dx = d.x * b.cos - d.z * b.sin;
  const dz = d.x * b.sin + d.z * b.cos;
  let t0 = 0;
  let t1 = Infinity;
  const slab = (p: number, v: number, lo: number, hi: number) => {
    if (Math.abs(v) < 1e-9) return p >= lo && p <= hi;
    let a = (lo - p) / v;
    let c = (hi - p) / v;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, c);
    return t0 <= t1;
  };
  if (!slab(lx, dx, -b.hw, b.hw) || !slab(o.y, d.y, -1, b.top) || !slab(lz, dz, -b.hd, b.hd)) return Infinity;
  return t0;
}

/**
 * Farthest the camera may sit from `target` along the unit direction `dir` (target → camera).
 * `radius` is the circle for this view; `ground` the lowest camera height, or null for none.
 */
export function farthestAllowed(target: THREE.Vector3, dir: THREE.Vector3, radius: number, ground: number | null): number {
  let far = Infinity;
  // Circle: |target.xz + t·dir.xz| = radius, the positive root.
  const a = dir.x * dir.x + dir.z * dir.z;
  if (a > 1e-8) {
    const b = 2 * (target.x * dir.x + target.z * dir.z);
    const c = target.x * target.x + target.z * target.z - radius * radius;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) far = Math.min(far, (-b + Math.sqrt(disc)) / (2 * a));
  }
  if (ground !== null && dir.y < -1e-6 && target.y > ground) far = Math.min(far, (ground - target.y) / dir.y);
  for (const box of contextBoxes()) far = Math.min(far, entry(box, target, dir));
  return Math.max(0, far);
}
