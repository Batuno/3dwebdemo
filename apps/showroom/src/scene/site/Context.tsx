import { assetUrl } from '../shared';
import { projectConfig } from '@bair/project-data';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Component, useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { mulberry32 } from '@bair/project-data';
import { setUpGltfLoader } from '../gltfLoader';
import { addWorldPos, sceneUniforms } from '../shared';
import { useMaterials } from '../materials';

// Neighbouring buildings, softened by haze. One box per building; the facade is drawn in the
// fragment shader, so windows stay crisp at any distance and light up at night.
function makeContextMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ name: 'M_Context', color: '#ffffff', roughness: 0.75 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = sceneUniforms.uNight;
    addWorldPos(shader);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocalN; varying vec4 vIdSeed;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vLocalN = normal;
        vIdSeed = vec4(instanceMatrix[3].xz, 0.0, 0.0);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNight;
        varying vec3 vLocalN; varying vec4 vIdSeed;
        float h21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float wFacade = 0.0;
        vec2 wId = vec2(0.0);
        if (abs(vLocalN.y) < 0.5) {
          vec2 f = vec2(abs(vLocalN.x) > 0.5 ? vWPos.z : vWPos.x, vWPos.y);
          vec2 cell = vec2(3.1 + h21(vIdSeed.xy) * 1.2, 3.0);
          vec2 uv = f / cell;
          wId = floor(uv);
          vec2 g = fract(uv);
          float inX = smoothstep(0.17, 0.2, g.x) * smoothstep(0.17, 0.2, 1.0 - g.x);
          float inY = smoothstep(0.3, 0.33, g.y) * smoothstep(0.14, 0.17, 1.0 - g.y);
          wFacade = inX * inY;
          float slab = smoothstep(0.03, 0.0, abs(g.y - 0.05));
          diffuseColor.rgb *= 1.0 - slab * 0.18;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.3, 0.34, 0.38) + 0.06 * h21(wId + vIdSeed.xy), wFacade);
        } else {
          diffuseColor.rgb *= 0.82;
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.22, wFacade);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float on = step(0.76, h21(wId * 0.73 + vIdSeed.xy * 0.11));
          totalEmissiveRadiance += wFacade * on * uNight * vec3(1.0, 0.74, 0.46) * (0.55 + h21(wId) * 0.8);
        }`,
      );
  };
  m.customProgramCacheKey = () => 'context-v1';
  return m;
}

interface Tower {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  rot: number;
  color: string;
}

const TONES = ['#d9d4c8', '#c9c6be', '#e3dfd6', '#bdb7ab', '#cfcabd', '#d2c8b6', '#b9bcbd'];

function placeTowers(): Tower[] {
  const rnd = mulberry32(8080);
  const list: Tower[] = [];
  const tone = () => TONES[Math.floor(rnd() * TONES.length)];
  // Hand-placed neighbours: north and west, the side you see behind the blocks from the overview.
  const near: [number, number, number, number, number][] = [
    [-200, -130, 34, 20, 66],
    [-130, -190, 38, 20, 72],
    [-60, -215, 30, 20, 58],
    [30, -205, 42, 20, 74],
    [120, -195, 36, 20, 62],
    [205, -160, 30, 22, 54],
    [-235, -30, 22, 36, 68],
    [-240, 70, 24, 40, 60],
    [-205, 170, 34, 20, 48],
    [-110, 200, 40, 18, 36],
  ];
  for (const [x, z, w, d, h] of near) {
    list.push({ x, z, w, d, h, rot: (rnd() - 0.5) * 0.12, color: tone() });
  }
  // City beyond, fading into haze. Leave a clear wedge south-east behind the camera.
  let guard = 0;
  while (list.length < 150 && guard++ < 2500) {
    const a = rnd() * Math.PI * 2;
    const r = 290 + rnd() * 1150;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (x > 90 && z > -60 && r < 800) continue;
    if (Math.abs(x) < 110 || Math.abs(z) < 95) continue;
    const tall = rnd();
    list.push({
      x,
      z,
      w: 24 + rnd() * 34,
      d: 16 + rnd() * 22,
      h: tall > 0.7 ? 60 + rnd() * 50 : 16 + rnd() * 36,
      rot: rnd() * 0.5 - 0.25,
      color: tone(),
    });
  }
  // Low and mid-rise fabric on a loose grid
  guard = 0;
  const towerCount = list.length;
  while (list.length < towerCount + 420 && guard++ < 6000) {
    const gx = Math.round(((rnd() * 2 - 1) * 1200) / 34) * 34;
    const gz = Math.round(((rnd() * 2 - 1) * 1200) / 34) * 34;
    const x = gx + (rnd() - 0.5) * 8;
    const z = gz + (rnd() - 0.5) * 8;
    if (Math.abs(x) < 118 && Math.abs(z) < 98) continue;
    if (x > 92 && Math.abs(z - 40) < 150) continue;
    const onGrid = (v: number) => Math.abs(((v / 130 + 0.5) % 1 + 1) % 1 - 0.5) * 130;
    if (onGrid(x) < 22 || onGrid(z) < 22) continue;
    if (Math.abs(x - 96) < 30 || Math.abs(z - 75) < 18 || Math.abs(z + 75) < 18 || Math.abs(x + 96) < 18) continue;
    list.push({ x, z, w: 16 + rnd() * 18, d: 12 + rnd() * 14, h: 7 + rnd() * rnd() * 34, rot: 0, color: tone() });
  }
  return list;
}

export function ContextBuildings() {
  useMaterials();
  const towers = useMemo(placeTowers, []);
  const mat = useMemo(makeContextMaterial, []);
  const mesh = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const m = new THREE.InstancedMesh(geo, mat, towers.length);
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    towers.forEach((t, i) => {
      o.position.set(t.x, 0, t.z);
      o.rotation.y = t.rot;
      o.scale.set(t.w, t.h, t.d);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(t.color));
    });
    m.name = 'Context';
    m.frustumCulled = false;
    m.castShadow = false;
    m.raycast = () => null;
    return m;
  }, [towers, mat]);
  useEffect(() => () => mesh.dispose(), [mesh]);
  return <primitive object={mesh} />;
}

/** A real surroundings model in place of the generated neighbours. */
function ContextModel() {
  const { url, position, rotationDeg } = projectConfig.context;
  const gl = useThree((s) => s.gl);
  const gltf = useGLTF(assetUrl(url), false, true, (loader) => setUpGltfLoader(loader as never, gl));
  return (
    <group name="Context" position={position} rotation-y={THREE.MathUtils.degToRad(rotationDeg)}>
      <primitive object={gltf.scene} />
    </group>
  );
}

/** A missing or broken surroundings file must not take the whole showroom down with it. */
class ContextFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn(`Context model could not load, using generated buildings: ${error.message}`);
  }

  render() {
    return this.state.failed ? <ContextBuildings /> : this.props.children;
  }
}

export function Surroundings() {
  if (!projectConfig.context.url) return <ContextBuildings />;
  return (
    <ContextFallback>
      <ContextModel />
    </ContextFallback>
  );
}
