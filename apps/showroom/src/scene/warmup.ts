// Shader warm-up: compiles programs the next views will need while the page is idle, so a first
// visit never stalls on compilation in the middle of a camera move.
import type * as THREE from 'three';

/** Puts a scene into an alternate state for compiling and returns a function that restores it. */
export type Warmup = () => () => void;

const warmups = new Set<Warmup>();

export function registerWarmup(w: Warmup): () => void {
  warmups.add(w);
  return () => {
    warmups.delete(w);
  };
}

/**
 * Compiles every material in the scene, hidden objects included, plus the alternates registered above.
 * With KHR_parallel_shader_compile the driver compiles in the background and this resolves when done.
 */
export async function warmUp(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Promise<void> {
  const restores = [...warmups].map((w) => w());
  let ready: Promise<unknown>;
  try {
    ready = typeof gl.compileAsync === 'function' ? gl.compileAsync(scene, camera) : Promise.resolve(gl.compile(scene, camera));
  } finally {
    restores.forEach((r) => r());
  }
  await ready;
}
