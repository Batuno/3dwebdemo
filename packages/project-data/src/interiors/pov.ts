// Where a hotspot's camera stands in the world, and what it can see from there.
import type { BlockDef, StackPlacement, Vec2 } from '../data/types';
import { OUTDOOR_EYE_HEIGHT, type OutdoorSpot } from '../data/outdoor';
import { storeyY, unitXform } from '../lib/geometry';
import { isWallAt } from './plan';
import type { Hotspot, InteriorLayout } from './types';

export const EYE_HEIGHT = 1.55;
export const DOT_HEIGHT = 0.5;

export interface SpotPose {
  pos: [number, number, number];
  /** Unit vector along the view, world space. */
  dir: [number, number, number];
  fov: number;
}

/** World camera for a hotspot, through the stack's rotation and mirroring. */
export function spotPose(def: BlockDef, st: StackPlacement, storey: number, h: Hotspot): SpotPose {
  const xf = unitXform(def, st);
  const [x, z] = xf.point(h.x, h.z);
  const yaw = (h.yaw * Math.PI) / 180;
  const [dx, dz] = xf.dir(Math.sin(yaw), -Math.cos(yaw));
  const pitch = (h.pitch * Math.PI) / 180;
  return {
    pos: [def.position[0] + x, storeyY(storey) + EYE_HEIGHT, def.position[1] + z],
    dir: [dx * Math.cos(pitch), Math.sin(pitch), dz * Math.cos(pitch)],
    fov: h.fov,
  };
}

/** World camera for an outdoor standing point. */
export function outdoorPose(s: OutdoorSpot): SpotPose {
  const yaw = (s.yaw * Math.PI) / 180;
  const pitch = (s.pitch * Math.PI) / 180;
  return {
    pos: [s.x, OUTDOOR_EYE_HEIGHT, s.z],
    dir: [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)],
    fov: s.fov,
  };
}

/** A world direction as seen on the minimap, where the plan is drawn mirrored like the real stack. */
export function headingOnPlan(def: BlockDef, st: StackPlacement, worldX: number, worldZ: number): Vec2 {
  const xf = unitXform(def, st);
  const c = Math.cos(xf.rotY);
  const s = Math.sin(xf.rotY);
  return [worldX * c - worldZ * s, worldX * s + worldZ * c];
}

/** Whether nothing solid stands between two floor points. Open door leaves do not block the view. */
export function lineOfSight(l: InteriorLayout, a: Vec2, b: Vec2): boolean {
  const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.04);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isWallAt(l, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
  }
  return true;
}

/** The hotspots worth drawing from one standing point: visible, nearby, and not the one underfoot. */
export function visibleSpots(l: InteriorLayout, from: Hotspot, maxDistance = 8): Hotspot[] {
  return l.hotspots.filter(
    (h) =>
      h.id !== from.id &&
      Math.hypot(h.x - from.x, h.z - from.z) <= maxDistance &&
      lineOfSight(l, [from.x, from.z], [h.x, h.z]),
  );
}
