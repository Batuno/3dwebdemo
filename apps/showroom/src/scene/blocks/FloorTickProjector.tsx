// Keeps the DOM floor ticks glued to their storeys beside the tower as the camera moves.
import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { blockById, STOREY_H, storeyY } from '@bair/project-data';
import { useAppStore } from '../../store/useAppStore';
import { tickElements } from '../../ui/FloorTicks';
import { getBuiltBlock } from './Block';

/** Room for the tick and its big number, clear of the floor panel and the time slider. */
const MARGIN_WITH_PANEL = 560;
const MARGIN_SLIDER_ONLY = 190;
const MARGIN_PHONE = 110;
const GAP = 26;

export function FloorTickProjector() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const { route } = useAppStore.getState();
    if (route.view !== 'block' && route.view !== 'floor') return;
    const def = blockById(route.block);
    if (!def) return;

    // Bounding corners of the tower footprint, in world space.
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const f of getBuiltBlock(def).footprints) {
      const c = Math.abs(Math.cos(f.rotY));
      const s = Math.abs(Math.sin(f.rotY));
      const hx = (f.size[0] * c + f.size[1] * s) / 2;
      const hz = (f.size[0] * s + f.size[1] * c) / 2;
      x0 = Math.min(x0, f.center[0] - hx);
      x1 = Math.max(x1, f.center[0] + hx);
      z0 = Math.min(z0, f.center[1] - hz);
      z1 = Math.max(z1, f.center[1] + hz);
    }

    // Whichever corner reads furthest right on screen carries the scale.
    const midY = storeyY(13);
    let best: [number, number] = [x1, z1];
    let bestX = -Infinity;
    for (const [lx, lz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
      point.set(def.position[0] + lx, midY, def.position[1] + lz).project(camera);
      if (point.x > bestX) {
        bestX = point.x;
        best = [lx, lz];
      }
    }

    const margin = size.width < 768 ? MARGIN_PHONE : route.view === 'block' ? MARGIN_WITH_PANEL : MARGIN_SLIDER_ONLY;
    const limit = size.width - margin;
    for (let n = 2; n <= def.storeys; n++) {
      const el = tickElements.get(n);
      if (!el) continue;
      point.set(def.position[0] + best[0], storeyY(n) + STOREY_H / 2, def.position[1] + best[1]).project(camera);
      const sx = Math.min(limit, ((point.x + 1) / 2) * size.width + GAP);
      const sy = ((1 - point.y) / 2) * size.height;
      el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translateY(-50%)`;
    }
  });
  return null;
}
