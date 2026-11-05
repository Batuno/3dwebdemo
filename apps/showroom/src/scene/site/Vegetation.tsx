import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { blocks, cameras, site, type Vec2, outdoorSpots } from '@bair/project-data';
import { mulberry32 } from '@bair/project-data';
import { clipTarget, getBuiltBlock } from '../blocks/Block';
import { roofY } from '@bair/project-data';
import { useMaterials } from '../materials';
import { requestShadowUpdate } from '../lighting/shadowControl';
import { addWorldPos, sceneUniforms } from '../shared';
import { useAppStore } from '../../store/useAppStore';
import { CROSSWALK_Z, eastX0, eastX1, northZ0, northZ1, PARK_PATHS, PARKS, smoothPath, southZ0, southZ1, STREET, westX0, westX1 } from './Ground';

/* ---------- Geometry ---------- */

function leafCard(
  out: { pos: number[]; nor: number[]; uv: number[]; col: number[]; idx: number[] },
  c: THREE.Vector3,
  size: number,
  crown: THREE.Vector3,
  radial: THREE.Vector3,
  rnd: () => number,
) {
  // Card lies roughly tangent to the crown so the silhouette stays full from every side.
  const n = new THREE.Vector3().subVectors(c, crown).multiply(radial).normalize();
  const jitter = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.9);
  const face = n.clone().add(jitter).normalize();
  const ref = Math.abs(face.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(face, ref).normalize();
  const v = new THREE.Vector3().crossVectors(face, u).normalize();
  const cell = Math.floor(rnd() * 4);
  const u0 = (cell % 2) * 0.5;
  const v0 = (cell >> 1) * 0.5;
  const start = out.pos.length / 3;
  const h = size / 2;
  // Shading: darker inside the crown and underneath it.
  const height = THREE.MathUtils.clamp((c.y - crown.y) / (radial.y > 0 ? 1 / radial.y : 1) + 0.5, 0, 1);
  const depth = THREE.MathUtils.clamp(new THREE.Vector3().subVectors(c, crown).multiply(radial).length(), 0, 1);
  const shade = 0.66 + 0.26 * depth + 0.24 * height;
  for (const [a, b, s, t] of [
    [-h, -h, 0, 0],
    [h, -h, 0.5, 0],
    [h, h, 0.5, 0.5],
    [-h, h, 0, 0.5],
  ]) {
    out.pos.push(c.x + u.x * a + v.x * b, c.y + u.y * a + v.y * b, c.z + u.z * a + v.z * b);
    out.nor.push(n.x, n.y + 0.25, n.z);
    out.uv.push(u0 + s, v0 + t);
    out.col.push(shade, shade, shade);
  }
  out.idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
}

interface TreeSpec {
  height: number;
  crownRadius: number;
  crownHeight: number;
  cards: number;
  cardSize: number;
  seed: number;
}

function makeCrown(spec: TreeSpec): THREE.BufferGeometry {
  const rnd = mulberry32(spec.seed);
  const out = { pos: [] as number[], nor: [] as number[], uv: [] as number[], col: [] as number[], idx: [] as number[] };
  const trunkTop = spec.height - spec.crownHeight * 0.8;
  const cy = trunkTop + spec.crownHeight * 0.45;
  const crown = new THREE.Vector3(0, cy, 0);
  const radial = new THREE.Vector3(1 / spec.crownRadius, 1 / (spec.crownHeight * 0.55), 1 / spec.crownRadius);
  // Lobes break up the perfect ellipsoid
  const lobes = Array.from({ length: 6 }, () => {
    const a = rnd() * Math.PI * 2;
    return { x: Math.cos(a) * spec.crownRadius * 0.55, y: (rnd() - 0.3) * spec.crownHeight * 0.32, z: Math.sin(a) * spec.crownRadius * 0.55, r: 0.55 + rnd() * 0.25 };
  });
  for (let i = 0; i < spec.cards; i++) {
    const l = lobes[i % lobes.length];
    const a = rnd() * Math.PI * 2;
    const y = rnd() * 2 - 1;
    const rr = Math.pow(rnd(), 0.4);
    const s = Math.sqrt(1 - y * y);
    const r = spec.crownRadius * l.r;
    const c = new THREE.Vector3(
      l.x + Math.cos(a) * s * r * rr,
      cy + l.y + y * r * 0.72 * rr,
      l.z + Math.sin(a) * s * r * rr,
    );
    leafCard(out, c, spec.cardSize * (0.8 + rnd() * 0.5), crown, radial, rnd);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
  g.setIndex(out.idx);
  return g;
}

function makeTrunk(spec: TreeSpec): THREE.BufferGeometry {
  const rnd = mulberry32(spec.seed + 99);
  const trunkTop = spec.height - spec.crownHeight * 0.55;
  const parts: THREE.BufferGeometry[] = [];
  const r0 = spec.height * 0.022;
  const main = new THREE.CylinderGeometry(r0 * 0.55, r0, trunkTop, 7, 1, true);
  main.translate(0, trunkTop / 2, 0);
  parts.push(main);
  const branches = 6;
  for (let i = 0; i < branches; i++) {
    const a = (i / branches) * Math.PI * 2 + rnd();
    const len = spec.crownRadius * (0.55 + rnd() * 0.35);
    const y = trunkTop * (0.58 + rnd() * 0.38);
    const b = new THREE.CylinderGeometry(r0 * 0.14, r0 * 0.34, len, 5, 1, true);
    b.translate(0, len / 2, 0);
    b.rotateZ(-(0.6 + rnd() * 0.5));
    b.rotateY(a);
    b.translate(0, y, 0);
    parts.push(b);
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/* ---------- Placement ---------- */

interface Spot {
  x: number;
  z: number;
  scale: number;
  rot: number;
  kind: number;
}

const inRect = (x: number, z: number, cx: number, cz: number, hw: number, hd: number) =>
  Math.abs(x - cx) < hw && Math.abs(z - cz) < hd;

function makeOccupancy() {
  const rects: [number, number, number, number][] = [];
  for (const b of blocks) {
    const d = getBuiltBlock(b);
    for (const f of d.footprints) {
      rects.push([b.position[0] + f.center[0], b.position[1] + f.center[1], f.size[0] / 2 + 3.2, f.size[1] / 2 + 3.2]);
    }
    rects.push([b.position[0] + d.liftCore.center[0], b.position[1] + d.liftCore.center[1], 8, 8]);
  }
  for (const a of site.amenities) {
    if (a.kind === 'garden') continue;
    rects.push([a.position[0], a.position[1], a.size[0] / 2 + 1.6, a.size[1] / 2 + 1.6]);
  }
  rects.push([site.plot.halfX - 3, CROSSWALK_Z, 4.5, 3.5]);
  const drop = site.amenities.find((a) => a.kind === 'dropOff')!;
  rects.push([(drop.position[0] + site.plot.halfX) / 2 + 2, drop.position[1], (site.plot.halfX - drop.position[0]) / 2 + 4, 5]);
  const ramp = site.amenities.find((a) => a.kind === 'garageEntry')!;
  rects.push([(ramp.position[0] + site.plot.halfX) / 2 + 4, ramp.position[1], 16, 6]);

  const lines = [...site.paths.map((p) => ({ pts: smoothPath(p.points, 2.5), r: p.width / 2 + 0.9 })), ...site.linkways.map((l) => ({ pts: smoothPath(l, 2.5), r: 2.4 }))];

  return (x: number, z: number, extra = 0) => {
    for (const [cx, cz, hw, hd] of rects) if (inRect(x, z, cx, cz, hw + extra, hd + extra)) return true;
    for (const { pts, r } of lines) {
      for (const p of pts) {
        if (Math.hypot(p[0] - x, p[1] - z) < r + extra) return true;
      }
    }
    return false;
  };
}

const VIEW_CLEAR_RADIUS = 4.5;
const VIEW_CORRIDOR_LENGTH = 16;
const VIEW_CORRIDOR_HALF_WIDTH = 2.6;

/** Planting stays out of each outdoor standing point and the first stretch of its view. */
function inOutdoorView(x: number, z: number): boolean {
  return outdoorSpots.some((s) => {
    const dx = x - s.x;
    const dz = z - s.z;
    if (Math.hypot(dx, dz) < VIEW_CLEAR_RADIUS) return true;
    const yaw = THREE.MathUtils.degToRad(s.yaw);
    const ahead = dx * Math.sin(yaw) - dz * Math.cos(yaw);
    const across = Math.abs(dx * Math.cos(yaw) + dz * Math.sin(yaw));
    return ahead > 0 && ahead < VIEW_CORRIDOR_LENGTH && across < VIEW_CORRIDOR_HALF_WIDTH;
  });
}

function placeTrees() {
  const rnd = mulberry32(2026);
  const near: Spot[] = [];
  const far: Spot[] = [];
  const inCamera = (x: number, z: number) => x > 96 && Math.abs(z - 40) < 80;
  const shrubs: Spot[] = [];
  const blocked = makeOccupancy();
  const { halfX, halfZ } = site.plot;

  const addNear = (x: number, z: number, big = 1) => {
    near.push({ x, z, scale: big * (0.8 + rnd() * 0.45), rot: rnd() * Math.PI * 2, kind: Math.floor(rnd() * 3) });
  };

  // Rows along the plot edge
  for (let x = -halfX + 4; x <= halfX - 4; x += 9.5 + rnd() * 2) {
    for (const z of [halfZ - 3.6, -halfZ + 3.6]) {
      if (!blocked(x, z, 1)) addNear(x, z);
    }
  }
  for (let z = -halfZ + 8; z <= halfZ - 8; z += 9.5 + rnd() * 2) {
    for (const x of [halfX - 3.6, -halfX + 3.6]) {
      if (!blocked(x, z, 1) && !(x > 0 && Math.abs(z - 30) < 22)) addNear(x, z, x > 0 ? 0.72 : 1);
    }
  }
  // Clusters in the grounds; more at the garden end
  let guard = 0;
  // Keep a sight line down the courtyard from the overview camera
  const inSightLine = (x: number, z: number) => x > -30 && Math.abs(z - x * 0.33) < 15;
  while (near.length < 74 && guard++ < 1500) {
    const x = (rnd() * 2 - 1) * (halfX - 6);
    const z = (rnd() * 2 - 1) * (halfZ - 6);
    if (blocked(x, z, 1.2) || inSightLine(x, z)) continue;
    if (near.some((t) => Math.hypot(t.x - x, t.z - z) < 7.2)) continue;
    addNear(x, z, 0.9);
  }

  // Street trees on both sides of each road
  for (let x = -280; x <= 280; x += 11) {
    if (x > westX1 - 7 && x < westX0 + 7) continue;
    if (x > eastX0 - 7 && x < eastX1 + 7) continue;
    addNear(x, southZ1 + 2.3, 0.85);
    if (Math.abs(x) > halfX + 8) addNear(x, southZ0 - 1.7, 0.85);
    addNear(x, northZ1 - 2.3, 0.85);
  }
  for (let z = -280; z <= 280; z += 11) {
    if (Math.abs(z - CROSSWALK_Z) < 6) continue;
    if (z > northZ1 - 7 && z < northZ0 + 7) continue;
    if (z > southZ0 - 7 && z < southZ1 + 7) continue;
    if (Math.abs(z - 30) > 34) addNear(eastX1 + 2.3, z, 0.7);
    addNear(westX1 - 2.3, z, 0.85);
  }

  // Distant canopy: cheap trees that read as mass through the haze
  const clear = (x: number, z: number) =>
    !(Math.abs(x) < halfX + 8 && Math.abs(z) < halfZ + 8) &&
    !(z > southZ0 - 5 && z < southZ1 + 7) &&
    !(z > northZ1 - 7 && z < northZ0 + 5) &&
    !(x > eastX0 - 5 && x < eastX1 + 7) &&
    !(x > westX1 - 7 && x < westX0 + 5);
  guard = 0;
  while (far.length < 900 && guard++ < 6000) {
    const a = rnd() * Math.PI * 2;
    const r = 240 + Math.pow(rnd(), 0.7) * 700;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!clear(x, z) || inCamera(x, z)) continue;
    far.push({ x, z, scale: 1.0 + rnd() * 0.8, rot: rnd() * 6.28, kind: 0 });
  }

  // Mid-distance canopy around the plot uses the same trees as the grounds
  guard = 0;
  let midCount = 0;
  while (midCount < 70 && guard++ < 2000) {
    const a = rnd() * Math.PI * 2;
    const r = 105 + rnd() * 130;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!clear(x, z) || inCamera(x, z)) continue;
    addNear(x, z, 0.95);
    midCount++;
  }

  // Parks across the streets: tree clusters that frame the opening shot from its sides, never in its line of
  // sight to the towers, and kept off the park paths.
  const parkPaths = PARK_PATHS.map((p) => ({ pts: smoothPath(p.points, 3), r: p.width / 2 }));
  const nearParkPath = (x: number, z: number, gap: number) =>
    parkPaths.some(({ pts, r }) => pts.some((p) => Math.hypot(p[0] - x, p[1] - z) < r + gap));
  const inPark = (x: number, z: number, inset: number) =>
    PARKS.some(([x0, z0, x1, z1]) => x > x0 + inset && x < x1 - inset && z > z0 + inset && z < z1 - inset);
  const [camX, , camZ] = cameras.opening.pos;
  const [aimX, , aimZ] = cameras.opening.target;
  const aimLen = Math.hypot(aimX - camX, aimZ - camZ);
  const aimDx = (aimX - camX) / aimLen;
  const aimDz = (aimZ - camZ) / aimLen;
  /** A cone around the opening shot's line to the towers, widening with distance, plus room around the lens. */
  const inOpeningView = (x: number, z: number) => {
    const rx = x - camX;
    const rz = z - camZ;
    if (Math.hypot(rx, rz) < 22) return true;
    const along = rx * aimDx + rz * aimDz;
    const across = Math.abs(rx * aimDz - rz * aimDx);
    return along > -12 && across < 16 + Math.max(0, along) * 0.22;
  };
  guard = 0;
  let parkTrees = 0;
  while (parkTrees < 56 && guard++ < 4000) {
    const [x0, z0, x1, z1] = PARKS[Math.floor(rnd() * PARKS.length)];
    const cx = x0 + rnd() * (x1 - x0);
    const cz = z0 + rnd() * (z1 - z0);
    if (!inPark(cx, cz, 4) || inOpeningView(cx, cz) || nearParkPath(cx, cz, 4)) continue;
    // A clump of three to five, the way a park is planted, rather than an even scatter.
    const clump = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < clump && parkTrees < 56; i++) {
      const a = rnd() * Math.PI * 2;
      const r = i === 0 ? 0 : 5 + rnd() * 6;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (!inPark(x, z, 3) || inOpeningView(x, z) || nearParkPath(x, z, 3.2)) continue;
      if (near.some((t) => Math.hypot(t.x - x, t.z - z) < 6.4)) continue;
      addNear(x, z, 0.95 + rnd() * 0.3);
      parkTrees++;
    }
  }

  // Shrub beds: along tower aprons and around amenities
  const shrubAt = (x: number, z: number, kind: number, s = 1) => {
    if (blocked(x, z, -0.5)) return;
    shrubs.push({ x, z, scale: s * (0.75 + rnd() * 0.6), rot: rnd() * 6.28, kind });
  };
  // Low planting along the first stretch of each park path, where the paths meet the street.
  for (const { pts, r } of parkPaths) {
    for (let i = 1; i < Math.min(pts.length - 1, 14); i++) {
      const [ax, az] = pts[i - 1];
      const [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az) || 1;
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      for (const side of [-1, 1]) {
        if (rnd() < 0.35) continue;
        const off = r + 1.1 + rnd() * 0.8;
        const x = pts[i][0] + nx * off * side;
        const z = pts[i][1] + nz * off * side;
        if (inPark(x, z, 1)) shrubAt(x, z, rnd() < 0.4 ? 1 : 0, 0.95);
      }
    }
  }
  for (const b of blocks) {
    const d = getBuiltBlock(b);
    for (const f of d.footprints) {
      const c = Math.cos(f.rotY);
      const sn = Math.sin(f.rotY);
      const per = (f.size[0] + f.size[1]) * 2;
      const n = Math.round(per / 1.15);
      for (let i = 0; i < n; i++) {
        const t = (i / n) * per;
        const w = f.size[0];
        const dp = f.size[1];
        let lx: number;
        let lz: number;
        if (t < w) {
          lx = t - w / 2;
          lz = -dp / 2 - 3.9;
        } else if (t < w + dp) {
          lx = w / 2 + 3.9;
          lz = t - w - dp / 2;
        } else if (t < 2 * w + dp) {
          lx = t - w - dp - w / 2;
          lz = dp / 2 + 3.9;
        } else {
          lx = -w / 2 - 3.9;
          lz = t - 2 * w - dp - dp / 2;
        }
        const x = b.position[0] + f.center[0] + lx * c + lz * sn;
        const z = b.position[1] + f.center[1] - lx * sn + lz * c;
        shrubAt(x, z, rnd() < 0.2 ? 1 : 0, 1.05);
      }
    }
  }
  for (const a of site.amenities) {
    if (a.kind === 'garden') continue;
    const per = (a.size[0] + a.size[1]) * 2;
    const n = Math.round(per / 1.5);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const x = a.position[0] + Math.cos(t) * (a.size[0] / 2 + 2.6);
      const z = a.position[1] + Math.sin(t) * (a.size[1] / 2 + 2.6);
      shrubAt(x, z, rnd() < 0.3 ? 1 : 0);
    }
  }
  // Colour planting scattered over the lawns and the garden
  const garden = site.amenities.find((a) => a.kind === 'garden')!;
  for (let i = 0; i < 260; i++) {
    const x = garden.position[0] + (rnd() - 0.5) * garden.size[0];
    const z = garden.position[1] + (rnd() - 0.5) * garden.size[1];
    shrubAt(x, z, rnd() < 0.45 ? 1 : 0, 0.9);
  }
  for (let i = 0; i < 240; i++) {
    const x = (rnd() * 2 - 1) * (halfX - 2);
    const z = (rnd() * 2 - 1) * (halfZ - 2);
    shrubAt(x, z, rnd() < 0.3 ? 1 : 0, 0.85);
  }
  const open = (p: Spot) => !inOutdoorView(p.x, p.z);
  return { near: near.filter(open), far, shrubs: shrubs.filter(open) };
}

/* ---------- Materials ---------- */

function makeLeafMaterial(map: THREE.Texture, base: string, sway: number, name: string): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    name,
    map,
    color: base,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    vertexColors: true,
    roughness: 0.82,
    envMapIntensity: 0.75,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sceneUniforms.uTime;
    shader.uniforms.uNight = sceneUniforms.uNight;
    addWorldPos(shader);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 ip = instanceMatrix[3].xyz;
          #else
            vec3 ip = vec3(0.0);
          #endif
          float k = max(0.0, position.y) * ${sway.toFixed(4)};
          float ph = ip.x * 0.31 + ip.z * 0.27;
          transformed.x += k * (sin(uTime * 1.1 + ph) + 0.4 * sin(uTime * 2.7 + ph * 1.7 + position.y));
          transformed.z += k * 0.7 * cos(uTime * 0.9 + ph * 1.3);
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;')
      .replace(
        '#include <opaque_fragment>',
        `// Light scattering through the leaves when the sun is behind them
        outgoingLight += diffuseColor.rgb * vec3(0.5, 0.5, 0.16) * 0.2;
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => `leaf-${sway}`;
  // Shadows need the same leaf cut-outs; picked up by whichever mesh uses this material.
  m.userData.depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map,
    alphaTest: 0.42,
  });
  return m;
}

/* ---------- Components ---------- */

function Instanced({
  geometry,
  material,
  spots,
  castShadow = true,
  receiveShadow = true,
  tint,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  spots: Spot[];
  castShadow?: boolean;
  receiveShadow?: boolean;
  tint?: (i: number, c: THREE.Color) => void;
}) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, spots.length);
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    spots.forEach((s, i) => {
      o.position.set(s.x, STREET.curb, s.z);
      o.rotation.y = s.rot;
      o.scale.setScalar(s.scale);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      if (tint) {
        tint(i, c);
        m.setColorAt(i, c);
      }
    });
    m.instanceMatrix.needsUpdate = true;
    m.castShadow = castShadow;
    m.receiveShadow = receiveShadow;
    if (material.userData.depthMaterial) m.customDepthMaterial = material.userData.depthMaterial;
    m.frustumCulled = false;
    m.raycast = () => null;
    return m;
  }, [geometry, material, spots, castShadow, receiveShadow, tint]);
  useEffect(() => () => mesh.dispose(), [mesh]);
  return <primitive object={mesh} />;
}

const TREES: TreeSpec[] = [
  { height: 11.5, crownRadius: 4.2, crownHeight: 7.4, cards: 260, cardSize: 1.9, seed: 11 },
  { height: 8.8, crownRadius: 3.4, crownHeight: 5.8, cards: 190, cardSize: 1.7, seed: 23 },
  { height: 14, crownRadius: 5.0, crownHeight: 8.8, cards: 320, cardSize: 2.1, seed: 37 },
];

export function Vegetation({ density }: { density: number }) {
  const lib = useMaterials();
  const { near, far, shrubs } = useMemo(placeTrees, []);

  const crownGeos = useMemo(() => TREES.map((t) => makeCrown({ ...t, cards: Math.round(t.cards * density) })), [density]);
  const trunkGeos = useMemo(() => TREES.map(makeTrunk), []);
  const farGeo = useMemo(() => makeCrown({ height: 12, crownRadius: 4.6, crownHeight: 7.6, cards: 42, cardSize: 3.8, seed: 5 }), []);
  const shrubGeo = useMemo(() => {
    const g = makeCrown({ height: 1.25, crownRadius: 0.92, crownHeight: 1.25, cards: 12, cardSize: 1.05, seed: 7 });
    return g;
  }, []);

  const leafMat = useMemo(() => makeLeafMaterial(lib.leafMap, '#c8c6a0', 0.012, 'M_Leaves'), [lib]);
  const farMat = useMemo(() => makeLeafMaterial(lib.leafMap, '#a7ae88', 0, 'M_LeavesFar'), [lib]);
  const shrubMat = useMemo(() => makeLeafMaterial(lib.leafMap, '#bcc698', 0.012, 'M_Shrubs'), [lib]);
  const barkMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ ...lib.sets.bark, name: 'M_Bark', color: '#9c8a78', roughness: 0.95 });
    return m;
  }, [lib]);

  const byKind = useMemo(() => [0, 1, 2].map((k) => near.filter((s) => s.kind === k)), [near]);
  const shrubKinds = useMemo(() => [0, 1].map((k) => shrubs.filter((s) => s.kind === k)), [shrubs]);

  const treeTint = useMemo(() => {
    const rnd = mulberry32(77);
    return (_: number, c: THREE.Color) => {
      c.setHSL(0.15 + rnd() * 0.07, 0.22 + rnd() * 0.22, 0.6 + rnd() * 0.22);
    };
  }, []);
  const flowerTint = useMemo(() => {
    const rnd = mulberry32(88);
    const palette = ['#d9628a', '#e88a4a', '#c9486a', '#efc75e', '#b45fb0'];
    return (_: number, c: THREE.Color) => {
      c.set(palette[Math.floor(rnd() * palette.length)]).multiplyScalar(1.5);
    };
  }, []);

  useEffect(() => {
    requestShadowUpdate();
  }, [near]);

  useEffect(
    () => () => {
      [...crownGeos, ...trunkGeos, farGeo, shrubGeo].forEach((g) => g.dispose());
    },
    [crownGeos, trunkGeos, farGeo, shrubGeo],
  );

  return (
    <group name="Vegetation">
      {byKind.map((spots, k) => (
        <group key={k}>
          <Instanced geometry={crownGeos[k]} material={leafMat} spots={spots} tint={treeTint} />
          <Instanced geometry={trunkGeos[k]} material={barkMat} spots={spots} />
        </group>
      ))}
      <Instanced geometry={farGeo} material={farMat} spots={far} castShadow={false} receiveShadow={false} tint={treeTint} />
      <Instanced geometry={shrubGeo} material={shrubMat} spots={shrubKinds[0]} tint={treeTint} />
      <Instanced geometry={shrubGeo} material={shrubMat} spots={shrubKinds[1]} tint={flowerTint} />
      <RoofPlants material={shrubMat} geometry={shrubGeo} />
    </group>
  );
}

function RoofPlants({ material, geometry }: { material: THREE.Material; geometry: THREE.BufferGeometry }) {
  const meshes = useMemo(
    () =>
      blocks.map((b) => {
        const pts = getBuiltBlock(b).roofPlants;
        const m = new THREE.InstancedMesh(geometry, material, pts.length);
        const o = new THREE.Object3D();
        const rnd = mulberry32(5150);
        const c = new THREE.Color();
        pts.forEach((p, i) => {
          o.position.set(p[0] + b.position[0], p[1], p[2] + b.position[1]);
          o.rotation.y = rnd() * 6.28;
          o.scale.setScalar(0.8 + rnd() * 0.9);
          o.updateMatrix();
          m.setMatrixAt(i, o.matrix);
          c.setHSL(0.2 + rnd() * 0.06, 0.28, 0.7);
          m.setColorAt(i, c);
        });
        m.frustumCulled = false;
        m.castShadow = false;
        m.receiveShadow = true;
        m.raycast = () => null;
        return { m, b };
      }),
    [geometry, material],
  );
  useEffect(() => () => meshes.forEach(({ m }) => m.dispose()), [meshes]);
  useFrame(() => {
    if (useAppStore.getState().route.view === 'garage') return;
    for (const { m, b } of meshes) m.visible = clipTarget(b) > roofY(b);
  });
  return (
    <>
      {meshes.map(({ m, b }) => (
        <primitive key={b.id} object={m} />
      ))}
    </>
  );
}

export type { Vec2 };
