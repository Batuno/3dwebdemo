import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { blocks, site, type Vec2 } from '@bair/project-data';
import { BatchSet } from '../blocks/meshBatch';
import { getBuiltBlock } from '../blocks/Block';
import { useMaterials } from '../materials';
import { addWorldPos, damp, NOISE_GLSL } from '../shared';
import { useAppStore } from '../../store/useAppStore';
import { requestShadowUpdate } from '../lighting/shadowControl';
import { registerWarmup } from '../warmup';

const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * See-through copy of the lawn for the open garage, made once. Swapping materials is free, while
 * flipping `transparent` on the shared lawn would recompile its shader in the middle of the camera move.
 */
function makeFadingGrass(grass: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const m = grass.clone();
  m.onBeforeCompile = grass.onBeforeCompile;
  m.customProgramCacheKey = grass.customProgramCacheKey;
  m.transparent = true;
  m.depthWrite = false;
  m.opacity = 1;
  return m;
}

export const STREET = {
  sidewalk: 3.5,
  mainWidth: 15,
  sideWidth: 9,
  span: 1600,
  curb: 0.15,
};
const { plot } = site;
export const southZ0 = plot.halfZ + STREET.sidewalk;
export const southZ1 = southZ0 + STREET.sideWidth;
export const eastX0 = plot.halfX + STREET.sidewalk;
export const eastX1 = eastX0 + STREET.mainWidth;
export const northZ0 = -plot.halfZ - STREET.sidewalk;
export const northZ1 = northZ0 - STREET.sideWidth;
export const westX0 = -plot.halfX - STREET.sidewalk;
export const westX1 = westX0 - STREET.sideWidth;

/** The crosswalk over the main (east) road, in the foreground of the overview shot. */
export const CROSSWALK_Z = 24;

/** Smooth a coarse path through its control points. */
export function smoothPath(points: Vec2[], step = 1.2): Vec2[] {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], 0, p[1])));
  const n = Math.max(4, Math.round(curve.getLength() / step));
  return curve.getPoints(n).map((v) => [v.x, v.z]);
}

/** Everything past the streets: a street grid, plazas and parks drawn in the shader. */
export const groundHole = { value: 0 };

function makeCityMaterial() {
  const m = new THREE.MeshStandardMaterial({ name: 'M_CityGround', color: '#ffffff', roughness: 0.95 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uHole = groundHole;
    addWorldPos(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uHole;\n${NOISE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 p = vWPos.xz;
          if (uHole > 0.5 && abs(p.x) < ${site.plot.halfX.toFixed(1)} && abs(p.y) < ${site.plot.halfZ.toFixed(1)}) discard;
          float n = fbm2(p * 0.012);
          float fine = fbm2(p * 0.17);
          vec3 park = mix(vec3(0.13, 0.17, 0.08), vec3(0.22, 0.25, 0.12), fine);
          vec3 plaza = mix(vec3(0.2, 0.2, 0.18), vec3(0.3, 0.29, 0.26), fine);
          vec3 col = mix(plaza, park, smoothstep(0.36, 0.5, n));
          // City blocks 130 m apart
          vec2 g = abs(fract(p / 130.0 + 0.5) - 0.5) * 130.0;
          float road = 1.0 - smoothstep(6.0, 7.0, min(g.x, g.y));
          col = mix(col, vec3(0.09, 0.09, 0.1), road);
          diffuseColor.rgb = col;
        }`,
      );
  };
  return m;
}

type GroundMat = 'grass' | 'asphalt' | 'paving' | 'sidewalk' | 'curb' | 'paint' | 'yellowPaint';

function rect(b: ReturnType<BatchSet<GroundMat>['get']>, x0: number, z0: number, x1: number, z1: number, y: number) {
  b.flat(
    [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
    y,
    true,
  );
}

/** Raised strip with kerb faces around it. */
function slabStrip(
  set: BatchSet<GroundMat>,
  top: GroundMat,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
) {
  rect(set.get(top), x0, z0, x1, z1, y);
  const c = set.get('curb');
  c.wall([x0, z0], [x1, z0], [0, -1], 0, y);
  c.wall([x1, z1], [x0, z1], [0, 1], 0, y);
  c.wall([x1, z0], [x1, z1], [1, 0], 0, y);
  c.wall([x0, z1], [x0, z0], [-1, 0], 0, y);
}

function buildGround() {
  const set = new BatchSet<GroundMat>();
  const S = STREET.span;
  const Y = STREET.curb;
  const asphalt = set.get('asphalt');
  const paint = set.get('paint');

  // Streets
  rect(asphalt, -S, southZ0, S, southZ1, 0.01);
  rect(asphalt, -S, northZ1, S, northZ0, 0.01);
  rect(asphalt, eastX0, -S, eastX1, S, 0.012);
  rect(asphalt, westX1, -S, westX0, S, 0.012);

  // Plot, with its kerb
  slabStrip(set, 'grass', -plot.halfX, -plot.halfZ, plot.halfX, plot.halfZ, Y + 0.02);

  // Sidewalk ring, split around the corners
  const sw = STREET.sidewalk;
  const O = (x0: number, z0: number, x1: number, z1: number) =>
    slabStrip(set, 'sidewalk', x0, z0, x1, z1, Y);
  O(-plot.halfX - sw, plot.halfZ, plot.halfX + sw, plot.halfZ + sw);
  O(-plot.halfX - sw, -plot.halfZ - sw, plot.halfX + sw, -plot.halfZ);
  O(plot.halfX, -plot.halfZ, plot.halfX + sw, plot.halfZ);
  O(-plot.halfX - sw, -plot.halfZ, -plot.halfX, plot.halfZ);

  // Far-side sidewalks with their own verges
  O(-S, southZ1, S, southZ1 + sw + 1);
  O(-S, northZ1 - sw - 1, S, northZ1);
  O(eastX1, -S, eastX1 + sw + 1, northZ1 - sw - 1);
  O(eastX1, southZ1 + sw + 1, eastX1 + sw + 1, S);
  O(eastX1, northZ0, eastX1 + sw + 1, southZ0);
  O(westX1 - sw - 1, -S, westX1, northZ1 - sw - 1);
  O(westX1 - sw - 1, southZ1 + sw + 1, westX1, S);
  O(westX1 - sw - 1, northZ0, westX1, southZ0);

  // Lane markings: a double centre line and dashes on the main road, dashed centre elsewhere
  const dash = (x0: number, z0: number, x1: number, z1: number) =>
    rect(paint, x0, z0, x1, z1, 0.03);
  const ec = (eastX0 + eastX1) / 2;
  const wc = (westX0 + westX1) / 2;
  for (let z = -S; z < S; z += 7) {
    if (z > northZ1 - 6 && z < northZ0 + 6) continue;
    if (z > southZ0 - 6 && z < southZ1 + 6) continue;
    if (Math.abs(z + 3.5 - CROSSWALK_Z) < 9) continue;
    dash(ec - 3.85, z, ec - 3.73, z + 3.2);
    dash(ec + 3.73, z, ec + 3.85, z + 3.2);
    dash(ec - 0.28, z, ec - 0.16, z + 7);
    dash(ec + 0.16, z, ec + 0.28, z + 7);
    rect(paint, wc - 0.06, z, wc + 0.06, z + 3.2, 0.03);
  }
  for (let x = -S; x < S; x += 7) {
    if (x > westX1 - 6 && x < westX0 + 6) continue;
    if (x > eastX0 - 6 && x < eastX1 + 6) continue;
    const sc = (southZ0 + southZ1) / 2;
    const nc = (northZ0 + northZ1) / 2;
    dash(x, sc - 0.06, x + 3.2, sc + 0.06);
    dash(x, nc - 0.06, x + 3.2, nc + 0.06);
  }
  // Edge lines
  for (const x of [eastX0 + 0.45, eastX1 - 0.45]) rect(paint, x - 0.06, -S, x + 0.06, S, 0.03);

  // Crosswalk over the main road, with stop bars either side
  const stripes = Math.floor(STREET.mainWidth);
  for (let i = 0; i < stripes; i++) {
    const x = eastX0 + 0.35 + i;
    rect(paint, x, CROSSWALK_Z - 2.3, x + 0.55, CROSSWALK_Z + 2.3, 0.032);
  }
  rect(paint, eastX0 + 0.4, CROSSWALK_Z - 3.4, ec - 0.3, CROSSWALK_Z - 3.1, 0.03);
  rect(paint, ec + 0.3, CROSSWALK_Z + 3.1, eastX1 - 0.4, CROSSWALK_Z + 3.4, 0.03);

  // Path from the crosswalk into the plot
  const pave = set.get('paving');
  rect(pave, plot.halfX - 6, CROSSWALK_Z - 2.4, plot.halfX + 0.02, CROSSWALK_Z + 2.4, Y + 0.035);

  // Aprons under each tower
  for (const b of blocks) {
    const data = getBuiltBlock(b);
    for (const f of data.footprints) {
      const hw = f.size[0] / 2 + 2.6;
      const hd = f.size[1] / 2 + 2.6;
      const c = Math.cos(f.rotY);
      const s = Math.sin(f.rotY);
      const P = (x: number, z: number): Vec2 => [
        b.position[0] + f.center[0] + x * c + z * s,
        b.position[1] + f.center[1] - x * s + z * c,
      ];
      pave.flat([P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd)], Y + 0.03, true);
    }
    const cHw = data.liftCore.size[0] / 2 + 4;
    const cHd = data.liftCore.size[1] / 2 + 4;
    const cx = b.position[0] + data.liftCore.center[0];
    const cz = b.position[1] + data.liftCore.center[1];
    pave.flat(
      [
        [cx - cHw, cz - cHd],
        [cx + cHw, cz - cHd],
        [cx + cHw, cz + cHd],
        [cx - cHw, cz + cHd],
      ],
      Y + 0.03,
      true,
    );
  }

  // Garden paths and the drop-off drive
  for (const p of site.paths) pave.ribbon(smoothPath(p.points), p.width, Y + 0.04);
  for (const l of site.linkways) pave.ribbon(smoothPath(l), 3.4, Y + 0.038);

  const drop = site.amenities.find((a) => a.kind === 'dropOff')!;
  rect(
    set.get('asphalt'),
    drop.position[0] - drop.size[0] / 2,
    drop.position[1] - 3.6,
    plot.halfX + STREET.sidewalk + 0.1,
    drop.position[1] + 3.6,
    Y + 0.042,
  );

  const ramp = site.amenities.find((a) => a.kind === 'garageEntry')!;
  rect(
    set.get('asphalt'),
    ramp.position[0] + ramp.size[0] / 2 - 0.5,
    ramp.position[1] - 3.8,
    plot.halfX + STREET.sidewalk + 0.1,
    ramp.position[1] + 3.8,
    Y + 0.042,
  );

  return set.toGeometries();
}

export function Ground() {
  const lib = useMaterials();
  const geos = useMemo(buildGround, []);
  const materials = useMemo<Record<GroundMat, THREE.Material>>(
    () => ({
      grass: lib.grass,
      asphalt: lib.asphalt,
      paving: lib.paving,
      sidewalk: lib.sidewalk,
      curb: lib.curb,
      paint: new THREE.MeshStandardMaterial({ name: 'M_RoadPaint', color: '#e9e7e0', roughness: 0.75 }),
      yellowPaint: new THREE.MeshStandardMaterial({ name: 'M_RoadPaintYellow', color: '#e3bb47', roughness: 0.75 }),
    }),
    [lib],
  );
  const cityMat = useMemo(makeCityMaterial, []);
  const fadingGrass = useMemo(() => makeFadingGrass(lib.grass), [lib]);
  useEffect(() => () => fadingGrass.dispose(), [fadingGrass]);
  const grassMesh = useRef<THREE.Mesh>(null);
  const view = useAppStore((st) => st.route.view);
  const open = view === 'garage';
  useEffect(() => {
    groundHole.value = open ? 1 : 0;
    requestShadowUpdate();
  }, [open]);
  // Lets the idle warm-up compile the see-through lawn before anyone opens the garage.
  useEffect(
    () =>
      registerWarmup(() => {
        const mesh = grassMesh.current;
        if (!mesh) return () => {};
        const was = mesh.material;
        mesh.material = fadingGrass;
        return () => {
          mesh.material = was;
        };
      }),
    [fadingGrass],
  );
  useFrame((_, dt) => {
    const mesh = grassMesh.current;
    if (!mesh) return;
    if (open) {
      if (mesh.material !== fadingGrass) {
        fadingGrass.opacity = 1;
        mesh.material = fadingGrass;
      }
      fadingGrass.opacity = reduceMotion ? 0.14 : damp(fadingGrass.opacity, 0.14, 4, dt);
    } else if (mesh.material !== lib.grass) {
      mesh.material = lib.grass;
    }
  });
  return (
    <group name="Ground">
      {/* Everything beyond the streets: fades into the haze */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.04} receiveShadow raycast={() => null}>
        <planeGeometry args={[7000, 7000]} />
        <primitive object={cityMat} attach="material" />
      </mesh>
      {geos.map(([k, g]) => (
        <mesh
          key={k}
          ref={k === 'grass' ? grassMesh : undefined}
          geometry={g}
          material={materials[k]}
          receiveShadow
          visible={!(open && (k === 'paving' || k === 'curb'))}
          raycast={() => null}
        />
      ))}
    </group>
  );
}
