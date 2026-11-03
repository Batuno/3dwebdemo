// A furnished unit built from its data: walls, finishes, doors, windows, curtains, lights and furniture.
// Used by the unit view and the top-down plan review. Mirrored stacks reuse it inside a flipped group.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CEILING, wallPlan, type InteriorLayout, type WallFace } from '@bair/project-data';
import { useAppStore } from '../../store/useAppStore';
import { BatchSet } from '../blocks/meshBatch';
import { sceneUniforms } from '../shared';
import { Decor } from './Decor';
import { FurnitureSet } from './furniture';
import { useInteriorMaterials, type InteriorMaterialName } from './interiorMaterials';

const SKIRTING = 0.08;
const CURTAIN_WIDTH = 0.42;
const CURTAIN_FOLDS = 5;
const CURTAIN_DEPTH = 0.035;

const curtains = new Map<string, THREE.BufferGeometry>();

/** A stacked curtain panel: a plane pushed into soft vertical folds that widen toward the hem. */
function curtainGeometry(height: number): THREE.BufferGeometry {
  const key = height.toFixed(3);
  let g = curtains.get(key);
  if (!g) {
    g = new THREE.PlaneGeometry(CURTAIN_WIDTH, height, 48, 6);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / CURTAIN_WIDTH + 0.5;
      const v = p.getY(i) / height + 0.5;
      const swell = 1 + (1 - v) * 0.35;
      p.setZ(i, Math.sin(u * Math.PI * 2 * CURTAIN_FOLDS) * CURTAIN_DEPTH * swell);
    }
    g.computeVertexNormals();
    curtains.set(key, g);
  }
  return g;
}
const FINISH = 0.004;
const COVE_DROP = 0.1;
const COVE_DEPTH = 0.24;

const faceBox = (f: WallFace, y0: number, y1: number, thick: number): { c: [number, number, number]; s: [number, number, number] } => {
  const mid = (f.from + f.to) / 2;
  const len = f.to - f.from;
  const inward = f.side === 'n' || f.side === 'w' ? thick / 2 : -thick / 2;
  const y = (y0 + y1) / 2;
  return f.side === 'n' || f.side === 's'
    ? { c: [mid, y, f.line + inward], s: [len, y1 - y0, thick] }
    : { c: [f.line + inward, y, mid], s: [thick, y1 - y0, len] };
};

function buildShell(l: InteriorLayout, cut: number | null) {
  const set = new BatchSet<InteriorMaterialName>();
  const plan = wallPlan(l);
  const top = cut ?? CEILING;

  for (const r of l.rooms) {
    const mat: InteriorMaterialName =
      r.floor === 'wood' ? 'floorOak' : r.floor === 'tile' ? (r.walls === 'tile' ? 'stoneTile' : 'kitchenFloor') : 'concrete';
    for (const [x0, z0, x1, z1] of r.rects) {
      set.get(mat).flat([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 0.002, true);
    }
  }

  // Doorways are left as clean openings, so nothing blocks the view between rooms. The floor runs through them.
  for (const d of plan.doors) {
    const [x0, z0, x1, z1] = d.rect;
    set.get('floorOak').flat([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 0.002, true);
  }

  // Structural walls. When the plan is cut, wall tops read as a solid black fill.
  for (const b of plan.boxes) {
    if (b.y0 >= top) continue;
    const y1 = Math.min(b.y1, top);
    const [x0, z0, x1, z1] = b.rect;
    const sliced = cut !== null && b.y1 >= cut;
    // A slightly wider slab just under the cut shows only at the edges, as a clean white outline.
    if (sliced) set.get('wallEdge').box([(x0 + x1) / 2, y1 - 0.06, (z0 + z1) / 2], [x1 - x0 + 0.05, 0.03, z1 - z0 + 0.05]);
    set.get(sliced ? 'wallCut' : 'bare').box([(x0 + x1) / 2, (b.y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - b.y0, z1 - z0]);
  }

  // No corridor is modelled outside the flat, so inside it the front doorway reads as plain wall. Plans keep the gap.
  if (cut === null) {
    for (const d of plan.doors.filter((o) => l.doors.find((x) => x.id === o.id)?.kind === 'entrance')) {
      const [x0, z0, x1, z1] = d.rect;
      const y1 = Math.min(d.head, top);
      // Slightly oversized, so it covers the joins with the wall on each side.
      const along = x1 - x0 > z1 - z0;
      const over = 2 * FINISH + 0.004;
      set.get('wall').box([(x0 + x1) / 2, (y1 + 0.01) / 2, (z0 + z1) / 2], [x1 - x0 + (along ? 0.04 : over), y1 + 0.01, z1 - z0 + (along ? over : 0.04)]);
    }
  }

  // Finishes on every wall face, per room.
  const byRoom = new Map(l.rooms.map((r) => [r.room, r]));
  for (const f of plan.faces) {
    const r = byRoom.get(f.room)!;
    if (f.y0 >= top) continue;
    const y1 = Math.min(f.y1, top);
    const accent = r.accent === f.side;
    const mat: InteriorMaterialName =
      r.walls === 'tile' ? (r.tileAccent === f.side ? 'sageTile' : 'stoneTile') : r.walls === 'bare' ? 'bare' : accent ? 'accentWall' : 'wall';
    const { c, s } = faceBox(f, f.y0, y1, FINISH);
    set.get(mat).box(c, s);
    if (r.walls === 'paint' && f.y0 === 0 && f.y1 > SKIRTING) {
      const sk = faceBox(f, 0, SKIRTING, 0.012);
      set.get('skirting').box(sk.c, sk.s);
    }
  }

  for (const w of plan.windows) {
    if (w.sill >= top) continue;
    buildWindowFrame(set, w.rect, w.sill, Math.min(w.head, top), w.louver);
  }
  return { geos: set.toGeometries(), plan };
}

function buildWindowFrame(set: BatchSet<InteriorMaterialName>, rect: [number, number, number, number], sill: number, head: number, louver: boolean) {
  const frame = set.get('frame');
  const [x0, z0, x1, z1] = rect;
  const alongX = x1 - x0 > z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const L = alongX ? x1 - x0 : z1 - z0;
  const h = head - sill;
  const bar = (offset: number, y: number, along: number, up: number) => {
    if (alongX) frame.box([cx + offset, y, cz], [along, up, 0.06]);
    else frame.box([cx, y, cz + offset], [0.06, up, along]);
  };
  bar(0, sill + 0.025, L, 0.05);
  bar(0, head - 0.025, L, 0.05);
  bar(-L / 2 + 0.025, sill + h / 2, 0.05, h);
  bar(L / 2 - 0.025, sill + h / 2, 0.05, h);
  const panes = louver ? Math.round(L / 0.12) : Math.max(1, Math.round(L / 0.9));
  for (let i = 1; i < panes; i++) bar(-L / 2 + (L * i) / panes, sill + h / 2, louver ? 0.03 : 0.035, h);
  if (alongX) set.get('skirting').box([cx, sill - 0.01, cz], [L, 0.02, z1 - z0 + 0.04]);
  else set.get('skirting').box([cx, sill - 0.01, cz], [x1 - x0 + 0.04, 0.02, L]);
}

export interface InteriorModelProps {
  layout: InteriorLayout;
  /** Cuts walls at this height for a top view. Null keeps full height. */
  cut?: number | null;
  ceiling?: boolean;
  /** Hides pieces hung above this height, so the plan stays readable. */
  hideAbove?: number;
  /** Overrides the viewer's choice of optional fittings, for exports. */
  fittings?: { partition: boolean };
  /** Rendered in its own canvas, away from the main scene's room lights. */
  standalone?: boolean;
}

export function InteriorModel({ layout, cut = null, ceiling = false, hideAbove, fittings, standalone = false }: InteriorModelProps) {
  const mats = useInteriorMaterials(!standalone);
  const chosen = useAppStore((s) => s.fittings);
  const { partition } = fittings ?? chosen;
  const { geos, plan } = useMemo(() => buildShell(layout, cut), [layout, cut]);
  // Recessed lights glow softly by day and come fully on after dark.
  useFrame(() => {
    if (!standalone) mats.light.emissiveIntensity = 0.5 + sceneUniforms.uNight.value * 2.2;
  });
  useEffect(() => () => geos.forEach(([, g]) => g.dispose()), [geos]);

  const pieces = useMemo(
    () => layout.furniture.filter((p) => (hideAbove === undefined || p.y < hideAbove) && (!p.optional || partition)),
    [layout, hideAbove, partition],
  );
  const lights = useMemo(() => layout.lights.filter((l) => l.kind === 'downlight' || l.kind === 'panel'), [layout]);
  const coves = useMemo(() => layout.lights.filter((l) => l.kind === 'cove'), [layout]);
  const pendants = useMemo(() => layout.lights.filter((l) => l.kind === 'pendant' || l.kind === 'linearPendant'), [layout]);

  const showHigh = cut === null;
  return (
    <group name="interior">
      {geos.map(([k, g]) => (
        <mesh key={k} geometry={g} material={mats[k]} castShadow={k !== 'floorOak'} receiveShadow raycast={() => null} />
      ))}
      <FurnitureSet pieces={pieces} mats={mats} />
      <Decor layout={layout} roomLit={!standalone} />

      {plan.windows.map((w) => {
        const [x0, z0, x1, z1] = w.rect;
        const alongX = x1 - x0 > z1 - z0;
        const L = alongX ? x1 - x0 : z1 - z0;
        const y = (w.sill + w.head) / 2;
        const h = w.head - w.sill;
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
        const inward = w.side === 'n' || w.side === 'w' ? 1 : -1;
        const face = w.side === 'n' ? z1 : w.side === 's' ? z0 : w.side === 'w' ? x1 : x0;
        return (
          <group key={w.id}>
            {!w.louver && (
              <mesh position={[cx, y, cz]} rotation-y={alongX ? 0 : Math.PI / 2} material={mats.glass} raycast={() => null}>
                <planeGeometry args={[L, h]} />
              </mesh>
            )}
            {showHigh && w.curtain !== 'none' &&
              // Bedrooms hang a sheer on the window side and blackout in front of it, on a double track.
              (w.curtain === 'blackout' ? (['curtainSheer', 'curtainBlackout'] as const) : (['curtainSheer'] as const)).flatMap((layer, depth) =>
                [-1, 1].map((sd) => {
                  const offset = (0.07 + depth * 0.08) * inward;
                  const along = (sd * L) / 2 + sd * (0.1 + depth * 0.06);
                  const px = alongX ? cx + along : face + offset;
                  const pz = alongX ? face + offset : cz + along;
                  return (
                    <mesh key={`${layer}${sd}`} position={[px, (w.head + 0.18) / 2, pz]} rotation-y={alongX ? 0 : Math.PI / 2} geometry={curtainGeometry(w.head + 0.16)} material={mats[layer]} castShadow={layer === 'curtainBlackout'} raycast={() => null} />
                  );
                }),
              )}
            {showHigh && w.curtain !== 'none' && (
              <mesh position={[alongX ? cx : face + 0.1 * inward, w.head + 0.18, alongX ? face + 0.1 * inward : cz]} material={mats.black} raycast={() => null}>
                <boxGeometry args={alongX ? [L + 0.6, 0.02, 0.02] : [0.02, 0.02, L + 0.6]} />
              </mesh>
            )}
          </group>
        );
      })}

      {showHigh &&
        lights.map((l, i) => (
          <mesh key={i} position={[l.x, CEILING - 0.006, l.z]} rotation-x={Math.PI / 2} material={mats.light} raycast={() => null}>
            {l.kind === 'panel' ? <planeGeometry args={[0.6, 0.3]} /> : <circleGeometry args={[0.05, 16]} />}
          </mesh>
        ))}
      {showHigh &&
        pendants.map((l, i) => (
          <group key={i} position={[l.x, 0, l.z]}>
            <mesh position={[0, (l.y + CEILING) / 2, 0]} material={mats.black} raycast={() => null}>
              <cylinderGeometry args={[0.005, 0.005, CEILING - l.y, 6]} />
            </mesh>
            {l.kind === 'linearPendant' ? (
              <mesh position={[0, l.y, 0]} material={mats.black} raycast={() => null}>
                <boxGeometry args={[0.05, 0.04, 1.2]} />
              </mesh>
            ) : (
              <mesh position={[0, l.y, 0]} material={mats.sand} raycast={() => null}>
                <sphereGeometry args={[0.2, 24, 16]} />
              </mesh>
            )}
          </group>
        ))}

      {showHigh &&
        coves.map((l, i) => {
          // Gypsum L-box along the room's window wall, with the LED strip hidden in its lip.
          const room = layout.rooms.find((r) => r.room === l.room)!.rects[0];
          const w = room[2] - room[0];
          const cx = (room[0] + room[2]) / 2;
          return (
            <group key={i}>
              <mesh position={[cx, CEILING - COVE_DROP / 2, room[1] + COVE_DEPTH / 2]} material={mats.ceiling} castShadow raycast={() => null}>
                <boxGeometry args={[w, COVE_DROP, COVE_DEPTH]} />
              </mesh>
              <mesh position={[cx, CEILING - COVE_DROP - 0.004, room[1] + COVE_DEPTH + 0.02]} material={mats.light} raycast={() => null}>
                <boxGeometry args={[w - 0.04, 0.008, 0.03]} />
              </mesh>
            </group>
          );
        })}

      {ceiling && (
        <mesh position={[layout.width / 2, CEILING, layout.depth / 2]} rotation-x={Math.PI / 2} material={mats.ceiling} raycast={() => null}>
          <planeGeometry args={[layout.width, layout.depth]} />
        </mesh>
      )}
    </group>
  );
}
