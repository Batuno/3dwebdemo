// A few real plants and objects (Poly Haven, CC0), so rooms feel lived in. Separate from the furnished
// inventory: they are styling, and nothing here counts towards clearances.
import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { planExtras, type InteriorLayout } from '@bair/project-data';
import { setUpGltfLoader } from '../gltfLoader';
import { assetUrl } from '../shared';
import { applyRoomLights } from './interiorLights';

function Model({ name, height, at, y = 0, only, roomLit }: { name: string; height: number; at: [number, number]; y?: number; only?: string; roomLit: boolean }) {
  const gl = useThree((s) => s.gl);
  const gltf = useGLTF(assetUrl(`models/${name}.glb`), false, false, (loader) => setUpGltfLoader(loader as never, gl));
  const { object, scale, offset } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    // Some files hold several variants of a plant side by side; keep one.
    if (only) clone.children.filter((c) => !c.name.endsWith(only)).forEach((c) => clone.remove(c));
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.raycast = () => null;
      if (roomLit) applyRoomLights(m.material as THREE.Material);
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const k = height / size.y;
    const c = box.getCenter(new THREE.Vector3());
    // Source models sit anywhere in their own file, so stand each on its footprint centre.
    return { object: clone, scale: k, offset: [-c.x * k, -box.min.y * k, -c.z * k] };
  }, [gltf, height, only, roomLit]);
  return <primitive object={object} scale={scale} position={[at[0] + offset[0], y + offset[1], at[1] + offset[2]]} />;
}

export function Decor({ layout, roomLit }: { layout: InteriorLayout; roomLit: boolean }) {
  const place = (p: [number, number]): [number, number] => (layout.mirrored ? [layout.width - p[0], p[1]] : p);
  const table = layout.furniture.find((p) => p.kind === 'coffeeTable');
  return (
    <Suspense fallback={null}>
      <group name="decor">
      {planExtras[layout.type].plants.map((p, i) => (
        <Model key={i} name={i % 2 ? 'potted_plant_04' : 'pachira_aquatica_01'} only={i % 2 ? undefined : '_a'} height={i % 2 ? 0.75 : 1.5} at={place(p)} roomLit={roomLit} />
      ))}
      {table && <Model name="ceramic_vase_01" height={0.24} at={[table.x, table.z]} y={table.h} roomLit={roomLit} />}
      </group>
    </Suspense>
  );
}
