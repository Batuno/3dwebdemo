import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { blockById, type BlockDef } from '@bair/project-data';
import { roofY, STOREY_H, storeyY } from '@bair/project-data';
import { useAppStore } from '../../store/useAppStore';
import { useMaterials } from '../materials';
import { damp, sceneUniforms } from '../shared';
import { requestShadowUpdate } from '../lighting/shadowControl';
import { buildBlock, type BuiltBlock, type FacadeMat } from './buildBlock';
import { makeWindowMaterial } from './windowMaterial';

const built = new Map<string, BuiltBlock>();
export function getBuiltBlock(b: BlockDef): BuiltBlock {
  let v = built.get(b.id);
  if (!v) {
    v = buildBlock(b);
    built.set(b.id, v);
  }
  return v;
}

function cloneForClip(m: THREE.Material, plane: THREE.Plane): THREE.Material {
  const c = m.clone();
  c.onBeforeCompile = m.onBeforeCompile;
  c.customProgramCacheKey = m.customProgramCacheKey;
  c.clippingPlanes = [plane];
  c.clipShadows = true;
  return c;
}

/** Height at which this block is cut, for the current route. */
export function clipTarget(b: BlockDef): number {
  const { route } = useAppStore.getState();
  if (route.view === 'garage') return 0.02;
  if ((route.view === 'floor' || route.view === 'unit') && route.block === b.id) {
    // Just below the slab top, so the cut never coincides with the floors drawn on top of it.
    return storeyY(route.storey) + 0.01;
  }
  // The block nearest the camera steps aside while the one behind it is in focus.
  if ((route.view === 'block' || route.view === 'floor') && route.block !== b.id) {
    const focus = blockById(route.block);
    if (focus && focus.position[1] < b.position[1]) return storeyY(3) - 0.2;
  }
  return roofY(b) + 12;
}

function makeBoxes(b: BuiltBlock, grow: number, height: number, y = height / 2): THREE.BufferGeometry {
  const geos = b.footprints.map((f) => {
    const g = new THREE.BoxGeometry(f.size[0] + grow * 2, height, f.size[1] + grow * 2);
    g.rotateY(f.rotY);
    g.translate(f.center[0], y, f.center[1]);
    return g;
  });
  const core = new THREE.BoxGeometry(b.liftCore.size[0] + grow * 2, height, b.liftCore.size[1] + grow * 2);
  core.rotateY(b.liftCore.rotY);
  core.translate(b.liftCore.center[0], y, b.liftCore.center[1]);
  geos.push(core);
  const merged = mergeGeometries(geos)!;
  geos.forEach((g) => g.dispose());
  return merged;
}

const proxyMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

export function Block({ def, detailedGlass }: { def: BlockDef; detailedGlass: boolean }) {
  const lib = useMaterials();
  const data = getBuiltBlock(def);
  const plane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, -1, 0), roofY(def) + 12),
    [def],
  );
  const invalidate = useThree((s) => s.invalidate);

  const mats = useMemo(() => {
    const out = {} as Record<FacadeMat, THREE.Material>;
    for (const k of Object.keys(lib.facade) as FacadeMat[]) {
      out[k] = cloneForClip(lib.facade[k], plane);
    }
    (out.lamp as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    return out;
  }, [lib, plane]);

  const windowMat = useMemo(() => {
    const m = makeWindowMaterial(detailedGlass);
    m.clippingPlanes = [plane];
    return m;
  }, [detailedGlass, plane]);

  const storeyCount = def.storeys - 1;

  // Repeated typical storey: one draw per material, instanced up the tower.
  const storeyMeshes = useMemo(() => {
    const dummy = new THREE.Matrix4();
    return data.storey.map(([key, geo]) => {
      const mesh = new THREE.InstancedMesh(geo, mats[key], storeyCount);
      for (let i = 0; i < storeyCount; i++) {
        dummy.makeTranslation(0, storeyY(i + 2), 0);
        mesh.setMatrixAt(i, dummy);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = key !== 'lamp';
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.raycast = () => null;
      return mesh;
    });
  }, [data, mats, storeyCount]);

  // Depth pre-pass: towers stack dozens of hidden walls per pixel, so laying depth down first
  // stops the expensive PBR shading from running on surfaces that end up hidden.
  const depthMeshes = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ colorWrite: false, clippingPlanes: [plane] });
    return storeyMeshes.map((src) => {
      const m = new THREE.InstancedMesh(src.geometry, mat, src.count);
      m.instanceMatrix = src.instanceMatrix;
      m.frustumCulled = false;
      m.renderOrder = -5;
      m.raycast = () => null;
      return m;
    });
  }, [storeyMeshes, plane]);

  const windowMesh = useMemo(() => {
    const n = data.windows.length * storeyCount;
    const quad = new THREE.PlaneGeometry(1, 1);
    const seeds = new Float32Array(n);
    const sizes = new Float32Array(n * 2);
    const mesh = new THREE.InstancedMesh(quad, windowMat, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    let i = 0;
    const blockSeed = def.id.charCodeAt(def.id.length - 1) * 0.137;
    for (let st = 0; st < storeyCount; st++) {
      const base = storeyY(st + 2);
      data.windows.forEach((w, wi) => {
        p.set(w.x, base + w.y, w.z);
        q.setFromAxisAngle(up, Math.atan2(w.nx, w.nz));
        s.set(w.w, w.h, 1);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        // Windows of the same flat on a floor stay coherent enough to read as one household
        const raw = Math.sin((st + 1) * 12.9898 + (Math.floor(wi / 3) + 1) * 78.233 + blockSeed) * 43758.5453;
        seeds[i] = raw - Math.floor(raw);
        sizes[i * 2] = w.w;
        sizes[i * 2 + 1] = w.h;
        i++;
      });
    }
    quad.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    quad.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 2));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    mesh.raycast = () => null;
    return mesh;
  }, [data, def.id, storeyCount, windowMat]);

  const groundMeshes = useMemo(
    () =>
      data.ground.map(([key, geo]) => {
        const mesh = new THREE.Mesh(geo, lib.facade[key]);
        mesh.castShadow = key !== 'slab';
        mesh.receiveShadow = true;
        mesh.raycast = () => null;
        return mesh;
      }),
    [data, lib],
  );
  const roofMeshes = useMemo(
    () =>
      data.roof.map(([key, geo]) => {
        const mesh = new THREE.Mesh(geo, mats[key]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.raycast = () => null;
        return mesh;
      }),
    [data, mats],
  );

  useEffect(() => {
    requestShadowUpdate();
    invalidate();
    return () => {
      windowMesh.dispose();
      storeyMeshes.forEach((m) => m.dispose());
    };
  }, [storeyMeshes, windowMesh, invalidate]);

  const open = useAppStore((st) => st.route.view === 'garage');

  useFrame((_, dt) => {
    const target = clipTarget(def);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const next = reduce ? target : damp(plane.constant, target, 3.2, dt);
    const moving = Math.abs(next - plane.constant) > 0.01;
    plane.constant = moving ? next : target;
    if (moving) requestShadowUpdate();
    const lamp = mats.lamp as THREE.MeshStandardMaterial;
    lamp.emissiveIntensity = sceneUniforms.uNight.value * 3;

    const { route, hover, selectedStorey } = useAppStore.getState();
    const lit = route.view === 'block' && route.block === def.id ? (hover.storey ?? selectedStorey) : null;
    (windowMat.userData.uHighlight.value as THREE.Vector2).set(
      lit ? storeyY(lit) : -1000,
      lit ? storeyY(lit) + STOREY_H : -1000,
    );
  });

  return (
    <group name={`Block_${def.id}`} position={[def.position[0], 0, def.position[1]]}>
      {depthMeshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      {storeyMeshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <primitive object={windowMesh} />
      <group visible={!open}>
        {groundMeshes.map((m, i) => (
          <primitive key={i} object={m} />
        ))}
      </group>
      {roofMeshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}

/* ---------- Picking and highlights ---------- */

export function BlockProxy({
  def,
  onHover,
  onOut,
  onPick,
  onMove,
}: {
  def: BlockDef;
  onHover?: (e: ThreeEvent<PointerEvent>) => void;
  onOut?: () => void;
  onPick?: (e: ThreeEvent<MouseEvent>) => void;
  onMove?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const data = getBuiltBlock(def);
  const geo = useMemo(() => makeBoxes(data, 0.2, roofY(def) + 3), [data, def]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh
      geometry={geo}
      material={proxyMaterial}
      position={[def.position[0], 0, def.position[1]]}
      onPointerOver={onHover}
      onPointerOut={onOut}
      onClick={onPick}
      onPointerMove={onMove}
    />
  );
}

/** Soft outline (inverted hull) plus a faint tint when a block is hovered. */
export function BlockHighlight({ def, active }: { def: BlockDef; active: boolean }) {
  const data = getBuiltBlock(def);
  const hullGeo = useMemo(() => makeBoxes(data, 0.3, roofY(def) + 3.4), [data, def]);
  const tintGeo = useMemo(() => makeBoxes(data, 0.12, roofY(def) + 3), [data, def]);
  const hullMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(def.labelColor).multiplyScalar(1.5),
        side: THREE.BackSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [def.labelColor],
  );
  const tintMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(def.labelColor),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    [def.labelColor],
  );
  useFrame((_, dt) => {
    hullMat.opacity = damp(hullMat.opacity, active ? 0.55 : 0, 9, dt);
    tintMat.opacity = damp(tintMat.opacity, active ? 0.07 : 0, 9, dt);
  });
  useLayoutEffect(
    () => () => {
      hullGeo.dispose();
      tintGeo.dispose();
    },
    [hullGeo, tintGeo],
  );
  return (
    <group position={[def.position[0], 0, def.position[1]]}>
      <mesh geometry={hullGeo} material={hullMat} raycast={() => null} renderOrder={5} />
      <mesh geometry={tintGeo} material={tintMat} raycast={() => null} renderOrder={6} />
    </group>
  );
}

const BAND_VERT = /* glsl */ `
  varying float vUp;
  void main() {
    vUp = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const BAND_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uHalf;
  varying float vUp;
  void main() {
    // Feathered top and bottom, so the storey glows instead of wearing a hard rectangle.
    float a = 1.0 - smoothstep(0.0, uHalf, abs(vUp));
    gl_FragColor = vec4(uColor, a * a * uOpacity);
  }`;

/** Soft glowing band around one storey. */
export function StoreyBand({
  def,
  storey,
  color,
  opacity = 0.55,
}: {
  def: BlockDef;
  storey: number;
  color: string;
  opacity?: number;
}) {
  const data = getBuiltBlock(def);
  const height = STOREY_H * 1.9;
  const geo = useMemo(() => makeBoxes(data, 0.34, height, 0), [data, height]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BAND_VERT,
        fragmentShader: BAND_FRAG,
        uniforms: {
          uColor: { value: new THREE.Color(color).multiplyScalar(1.5) },
          uOpacity: { value: opacity },
          uHalf: { value: height / 2 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
      }),
    [color, opacity, height],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  return (
    <mesh
      geometry={geo}
      material={mat}
      position={[def.position[0], storeyY(storey) + STOREY_H / 2, def.position[1]]}
      raycast={() => null}
      renderOrder={7}
    />
  );
}
