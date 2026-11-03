// Simple boxes for each flat stack, used for label line of sight, camera collisions and fly-to clicks.
import * as THREE from 'three';
import { blocks, roofY } from '@bair/project-data';
import { getBuiltBlock } from '../blocks/Block';

let cached: THREE.Mesh[] | null = null;

export function getOccluders(): THREE.Mesh[] {
  if (cached) return cached;
  const material = new THREE.MeshBasicMaterial();
  cached = blocks.flatMap((b) =>
    getBuiltBlock(b).footprints.map((f) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(f.size[0], roofY(b), f.size[1]), material);
      m.position.set(b.position[0] + f.center[0], roofY(b) / 2, b.position[1] + f.center[1]);
      m.rotation.y = f.rotY;
      m.updateMatrixWorld(true);
      return m;
    }),
  );
  return cached;
}

let ground: THREE.Mesh | null = null;

/** A wide plane the camera can never pass below. */
export function getGroundCollider(): THREE.Mesh {
  if (ground) return ground;
  ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.8;
  ground.updateMatrixWorld(true);
  return ground;
}
