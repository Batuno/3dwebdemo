import { useEffect, useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { blocks, garage, site, type Vec2 } from '@bair/project-data';
import { t } from '@bair/project-data';
import { formatPriceShort } from '@bair/project-data';
import { garageBays, type GarageBay } from '@bair/project-data';
import { CLICK_SLOP } from '../shared';
import { useAppStore } from '../../store/useAppStore';
import { BatchSet } from '../blocks/meshBatch';
import { getBuiltBlock } from '../blocks/Block';
import { useMaterials } from '../materials';
import { requestShadowUpdate } from '../lighting/shadowControl';

const STATUS = { available: '#3f9e64', reserved: '#d79a24', sold: '#7d858c' } as const;

export interface BayPlacement {
  bay: GarageBay;
  x: number;
  z: number;
}

/** Double-loaded rows of bays either side of the aisles, centred under the site. */
export function layoutBays(): { bays: BayPlacement[]; halfX: number; halfZ: number; aisles: number[] } {
  const { columns, rows, bayWidth, bayDepth, aisleWidth } = garage;
  const halfX = (columns * bayWidth) / 2;
  const module = bayDepth * 2 + aisleWidth;
  const pairs = Math.ceil(rows / 2);
  const totalZ = pairs * module;
  const aisles: number[] = [];
  const bays = garageBays.map((bay) => {
    const pair = Math.floor(bay.row / 2);
    const top = bay.row % 2 === 0;
    const pz = -totalZ / 2 + pair * module;
    const z = top ? pz + bayDepth / 2 : pz + bayDepth + aisleWidth + bayDepth / 2;
    return { bay, x: -halfX + bay.column * bayWidth + bayWidth / 2, z };
  });
  for (let i = 0; i < pairs; i++) aisles.push(-totalZ / 2 + i * module + bayDepth + aisleWidth / 2);
  return { bays, halfX, halfZ: totalZ / 2, aisles };
}

type GMat = 'floor' | 'wall' | 'column' | 'paint' | 'lobby' | 'ramp' | 'lamp';

function buildShell(l: ReturnType<typeof layoutBays>) {
  const set = new BatchSet<GMat>();
  const y = garage.depthY;
  const h = 3.4;
  const m = 1.5;
  const X = l.halfX + m;
  const Z = l.halfZ + m;
  set.get('floor').flat(
    [
      [-X, -Z],
      [X, -Z],
      [X, Z],
      [-X, Z],
    ],
    y,
    true,
  );
  const wall = set.get('wall');
  wall.wall([-X, -Z], [X, -Z], [0, 1], y, y + h);
  wall.wall([X, Z], [-X, Z], [0, -1], y, y + h);
  wall.wall([X, -Z], [X, Z], [-1, 0], y, y + h);
  wall.wall([-X, Z], [-X, -Z], [1, 0], y, y + h);

  const paint = set.get('paint');
  const lamp = set.get('lamp');
  const { columns, bayWidth, bayDepth, aisleWidth } = garage;
  // Bay lines
  for (const p of l.bays) {
    if (p.bay.column === 0 || p.bay.column === columns - 1) {
      /* the end columns get the outer line below */
    }
    const lx = p.x - bayWidth / 2;
    paint.box([lx, y + 0.012, p.z], [0.09, 0.012, bayDepth]);
    if (p.bay.column === columns - 1) paint.box([lx + bayWidth, y + 0.012, p.z], [0.09, 0.012, bayDepth]);
  }
  // Columns every third bay, along the aisle edges
  const col = set.get('column');
  for (const a of l.aisles) {
    for (let i = 0; i <= columns; i += 3) {
      const x = -l.halfX + i * bayWidth;
      for (const s of [-1, 1]) {
        const cz = a + s * (aisleWidth / 2 + bayDepth);
        col.box([x, y + h / 2, cz], [0.62, h, 0.62], 0, { noBottom: true });
        // Hazard banding
        paint.box([x, y + 0.5, cz], [0.66, 0.05, 0.66]);
      }
    }
    // Lamps down each aisle and direction arrows
    for (let x = -l.halfX + 4; x < l.halfX; x += 9) {
      lamp.box([x, y + h - 0.08, a], [1.3, 0.06, 0.14], 0, { noTop: true });
    }
    for (let x = -l.halfX + 6; x < l.halfX; x += 16) {
      paint.box([x, y + 0.012, a], [1.3, 0.012, 0.12]);
      paint.ribbon(
        [
          [x + 0.2, a - 0.32],
          [x + 0.7, a],
          [x + 0.2, a + 0.32],
        ],
        0.12,
        y + 0.016,
      );
    }
  }
  // Lift lobbies up to each block
  const lobby = set.get('lobby');
  for (const b of blocks) {
    const core = getBuiltBlock(b).liftCore;
    const cx = b.position[0] + core.center[0];
    const cz = b.position[1] + core.center[1];
    const px = THREE.MathUtils.clamp(cx, -X + 3, X - 3);
    const pz = THREE.MathUtils.clamp(cz, -Z + 3, Z - 3);
    lobby.box([px, y + h / 2, pz], [6, h, 5], 0, { noBottom: true });
  }
  // Ramp from the street down to B1
  const r = site.garageRamp.position;
  const ramp = set.get('ramp');
  const topX = r[0] + 9;
  const lowX = Math.min(X - 1, r[0] - 9);
  ramp.quad([topX, 0.2, r[1] - 3.3], [topX, 0.2, r[1] + 3.3], [lowX, y + 0.02, r[1] + 3.3], [lowX, y + 0.02, r[1] - 3.3], [0.2, 0.98, 0]);
  return set.toGeometries();
}

const PLATE_W = 1.5;
const PLATE_D = 0.75;
const CELL_W = 128;
const CELL_H = 64;
const ATLAS_COLUMNS = 16;

/**
 * Every bay number in one canvas, and one mesh of quads that each sample their own cell:
 * a single texture upload and a single draw instead of one per bay.
 */
function bayNumbers(l: ReturnType<typeof layoutBays>) {
  const rows = Math.ceil(l.bays.length / ATLAS_COLUMNS);
  const c = document.createElement('canvas');
  c.width = ATLAS_COLUMNS * CELL_W;
  c.height = rows * CELL_H;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.font = '700 40px Manrope Variable, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const n = l.bays.length;
  const position = new Float32Array(n * 12);
  const normal = new Float32Array(n * 12);
  const uv = new Float32Array(n * 8);
  const index = new Uint32Array(n * 6);
  const y = garage.depthY + 0.025;
  l.bays.forEach((p, i) => {
    const col = i % ATLAS_COLUMNS;
    const row = Math.floor(i / ATLAS_COLUMNS);
    g.fillText(String(p.bay.number), col * CELL_W + CELL_W / 2, row * CELL_H + 34);
    const u0 = col / ATLAS_COLUMNS;
    const u1 = (col + 1) / ATLAS_COLUMNS;
    const vTop = 1 - row / rows;
    const vBottom = 1 - (row + 1) / rows;
    // Lying flat, facing up, with the top of the number towards -z (as a plane turned -90° about x).
    const corners: [number, number, number, number][] = [
      [-PLATE_W / 2, -PLATE_D / 2, u0, vTop],
      [PLATE_W / 2, -PLATE_D / 2, u1, vTop],
      [-PLATE_W / 2, PLATE_D / 2, u0, vBottom],
      [PLATE_W / 2, PLATE_D / 2, u1, vBottom],
    ];
    corners.forEach(([dx, dz, u, v], k) => {
      position.set([p.x + dx, y, p.z + dz], (i * 4 + k) * 3);
      normal.set([0, 1, 0], (i * 4 + k) * 3);
      uv.set([u, v], (i * 4 + k) * 2);
    });
    const b = i * 4;
    index.set([b, b + 2, b + 1, b + 2, b + 3, b + 1], i * 6);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  const atlas = new THREE.CanvasTexture(c);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  // map + transparent: the Unreal export (exportGltf sitePart) skips bay numbers by exactly this.
  const material = new THREE.MeshBasicMaterial({ map: atlas, transparent: true, depthWrite: false, toneMapped: false });
  return { geometry, material, atlas };
}

const noRaycast = () => null;

function Bays({ l, active }: { l: ReturnType<typeof layoutBays>; active: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const selected = useAppStore((s) => s.garageSelection);
  const select = useAppStore((s) => s.setGarageSelection);
  const parking = useAppStore((s) => s.parking);
  const taken = useMemo(() => new Set(Object.values(parking)), [parking]);
  const tick = useAppStore((s) => s.inventoryTick);

  const mesh = useMemo(() => {
    const g = new THREE.PlaneGeometry(garage.bayWidth - 0.14, garage.bayDepth - 0.1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.InstancedMesh(
      g,
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, transparent: true, opacity: 0.82 }),
      l.bays.length,
    );
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    l.bays.forEach((p, i) => {
      o.position.set(p.x, garage.depthY + 0.01, p.z);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(STATUS[p.bay.status]));
    });
    m.frustumCulled = false;
    return m;
  }, [l]);

  // Reflect selection on the instances
  useEffect(() => {
    const c = new THREE.Color();
    l.bays.forEach((p, i) => {
      const base = c.set(STATUS[p.bay.status]);
      if (p.bay.id === selected || taken.has(p.bay.id)) c.set('#ffffff');
      else if (i === hover) base.multiplyScalar(1.5);
      mesh.setColorAt(i, c);
    });
    mesh.instanceColor!.needsUpdate = true;
  }, [hover, selected, taken, l, mesh, tick]); // tick: live statuses change the bays in place

  useEffect(
    () => () => {
      mesh.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.geometry.dispose();
    },
    [mesh],
  );

  // While hidden, the bays must not catch the pointer through the ground (raycasts ignore visibility).
  useEffect(() => {
    mesh.raycast = active ? THREE.InstancedMesh.prototype.raycast : noRaycast;
    if (!active) setHover(null);
  }, [mesh, active]);

  const plates = useMemo(() => bayNumbers(l), [l]);
  useEffect(
    () => () => {
      plates.geometry.dispose();
      plates.material.dispose();
      plates.atlas.dispose();
    },
    [plates],
  );

  const hovered = active && hover != null ? l.bays[hover] : null;
  return (
    <group>
      <primitive
        object={mesh}
        onPointerMove={(e: { instanceId?: number; stopPropagation: () => void }) => {
          e.stopPropagation();
          if (e.instanceId !== undefined && e.instanceId !== hover) setHover(e.instanceId);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(null);
          document.body.style.cursor = '';
        }}
        onClick={(e: { instanceId?: number; delta: number; stopPropagation: () => void }) => {
          if (e.delta > CLICK_SLOP) return;
          e.stopPropagation();
          if (e.instanceId !== undefined) select(l.bays[e.instanceId].bay.id);
        }}
      />
      <mesh geometry={plates.geometry} material={plates.material} raycast={noRaycast} />
      {hovered && (
        <Html position={[hovered.x, garage.depthY + 1.2, hovered.z]} center zIndexRange={[30, 20]} wrapperClass="scene-label" pointerEvents="none">
          <div className="scene-tip">
            {t.garage.bay} {hovered.bay.id} · {formatPriceShort(hovered.bay.price)} · {t.status[hovered.bay.status]}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Mounted once (ahead of the first visit, when the page is idle) and kept; shown only in its own view. */
export default function Garage() {
  const active = useAppStore((s) => s.route.view === 'garage');
  const lib = useMaterials();
  const l = useMemo(layoutBays, []);
  const geos = useMemo(() => buildShell(l), [l]);
  const mats = useMemo<Record<GMat, THREE.Material>>(
    () => ({
      floor: new THREE.MeshStandardMaterial({ ...lib.sets.concrete, color: '#8f8e8b', roughness: 0.55 }),
      wall: new THREE.MeshStandardMaterial({ ...lib.sets.concrete, color: '#b8b6b0', roughness: 0.85, side: THREE.DoubleSide }),
      column: new THREE.MeshStandardMaterial({ color: '#c9c7c1', roughness: 0.8 }),
      paint: new THREE.MeshStandardMaterial({ color: '#efe9d6', roughness: 0.7 }),
      lobby: new THREE.MeshStandardMaterial({ color: '#4c423a', roughness: 0.55 }),
      ramp: new THREE.MeshStandardMaterial({ ...lib.sets.asphalt, color: '#6f6e6c', roughness: 0.9, side: THREE.DoubleSide }),
      lamp: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff1d6', emissiveIntensity: 5 }),
    }),
    [lib],
  );
  const lobbies = useMemo<{ id: string; p: Vec2 }[]>(
    () =>
      blocks.map((b) => {
        const core = getBuiltBlock(b).liftCore;
        return {
          id: b.id,
          p: [
            THREE.MathUtils.clamp(b.position[0] + core.center[0], -l.halfX + 2, l.halfX - 2),
            THREE.MathUtils.clamp(b.position[1] + core.center[1], -l.halfZ + 2, l.halfZ - 2),
          ],
        };
      }),
    [l],
  );
  useEffect(
    () => () => {
      geos.forEach(([, g]) => g.dispose());
    },
    [geos],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const earth = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6e6152', roughness: 1 }), []);
  useEffect(() => () => earth.dispose(), [earth]);
  useEffect(() => {
    requestShadowUpdate();
  }, [active]);
  return (
    <group name="Garage" visible={active}>
      {geos.map(([k, g]) => (
        <mesh key={k} geometry={g} material={mats[k]} receiveShadow raycast={noRaycast} />
      ))}
      {/* Earth around the excavation, so the open site reads as a section through the ground */}
      <mesh rotation-x={-Math.PI / 2} position-y={garage.depthY - 0.25} material={earth} raycast={noRaycast}>
        <planeGeometry args={[site.plot.halfX * 2 + 8, site.plot.halfZ * 2 + 8]} />
      </mesh>
      <Bays l={l} active={active} />
      {/* HTML labels ignore a hidden parent, so they only exist while the garage is on screen. */}
      {active &&
        lobbies.map((o) => (
          <Html key={o.id} position={[o.p[0], garage.depthY + 4, o.p[1]]} center zIndexRange={[19, 10]} wrapperClass="scene-label" pointerEvents="none">
            <span className="amenity-pill">{t.garage.lobby(o.id)}</span>
          </Html>
        ))}
      {active && (
        <Html position={[site.garageRamp.position[0], 2, site.garageRamp.position[1]]} center zIndexRange={[19, 10]} wrapperClass="scene-label" pointerEvents="none">
          <span className="amenity-pill">{t.amenity.garageEntry}</span>
        </Html>
      )}
    </group>
  );
}
