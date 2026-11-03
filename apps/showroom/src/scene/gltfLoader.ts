import type * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { basisPath } from './shared';

let ktx2: KTX2Loader | null = null;

/** Every model here may use compressed textures and geometry, so each loader gets the same decoders. */
export function setUpGltfLoader(loader: GLTFLoader, gl: THREE.WebGLRenderer) {
  if (!ktx2) ktx2 = new KTX2Loader().setTranscoderPath(basisPath()).detectSupport(gl);
  loader.setKTX2Loader(ktx2 as never);
  loader.setMeshoptDecoder(MeshoptDecoder as never);
}
