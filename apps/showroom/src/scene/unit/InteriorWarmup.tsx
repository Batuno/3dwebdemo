// Compiles a flat's shaders while the visitor is still looking at the site. Entering a flat used to compile
// its materials, the decor plants and the hotspot dots on the first frames inside, in the middle of the
// camera's glide, which showed as a stutter. These are the same materials and models the flat uses, so the
// programs compiled here are the ones it will ask for, and keeping this mounted keeps them cached.
import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { setUpGltfLoader } from '../gltfLoader';
import { assetUrl } from '../shared';
import { compileOffscreen } from '../warmup';
import { DECOR_MODELS } from './Decor';
import { dotGeometry, dotGlass, dotHalo, haloGeometry } from './HotspotDots';
import { applyRoomLights } from './interiorLights';
import { useInteriorMaterials } from './interiorMaterials';

export default function InteriorWarmup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  // Room-lit, as inside a flat. Held for as long as this is mounted: a disposed material releases its program.
  const mats = useInteriorMaterials(true);
  const decor = useGLTF(
    DECOR_MODELS.map((name) => assetUrl(`models/${name}.glb`)),
    false,
    false,
    (loader) => setUpGltfLoader(loader as never, gl),
  );

  useEffect(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const group = new THREE.Group();
    for (const m of Object.values(mats)) group.add(new THREE.Mesh(box, m));
    for (const g of decor) {
      // Decor shares the loaded materials and room-lights them the same way (see Decor).
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) group.add(new THREE.Mesh(m.geometry, applyRoomLit(m.material as THREE.Material)));
      });
    }
    group.add(new THREE.Mesh(dotGeometry, dotGlass), new THREE.Mesh(haloGeometry, dotHalo));
    void compileOffscreen(gl, group, camera, scene).catch(() => {});
    // Compiling only reads which attributes the geometry has, so the box can go once this unmounts.
    return () => box.dispose();
  }, [gl, scene, camera, mats, decor]);
  return null;
}

function applyRoomLit(m: THREE.Material): THREE.Material {
  applyRoomLights(m);
  return m;
}
