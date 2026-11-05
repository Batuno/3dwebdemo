// Shader warm-up: compiles programs the next views will need while the page is idle, so a first
// visit never stalls on compilation in the middle of a camera move.
import * as THREE from 'three';

/** Puts a scene into an alternate state for compiling and returns a function that restores it. */
export type Warmup = () => () => void;

const warmups = new Set<Warmup>();

/** The composer draws into off-screen buffers, so programs are compiled against one of these. */
let offscreen: THREE.WebGLRenderTarget | null = null;

interface Program {
  getUniforms: () => unknown;
}

export function registerWarmup(w: Warmup): () => void {
  warmups.add(w);
  return () => {
    warmups.delete(w);
  };
}

/**
 * Compiles every material in the scene, hidden objects included, plus the alternates registered above,
 * then finishes each program in idle moments (see finish).
 */
export async function warmUp(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Promise<void> {
  const restores = [...warmups].map((w) => w());
  offscreen ??= new THREE.WebGLRenderTarget(1, 1);
  const previous = gl.getRenderTarget();
  let ready: Promise<unknown>;
  let programs: Set<Program>;
  try {
    // Into an off-screen buffer, as the composer draws: compiled for the screen, the programs never matched.
    gl.setRenderTarget(offscreen);
    ready = gl.compileAsync(scene, camera);
    // Collected while the alternates are still in place.
    programs = programsOf(gl, scene);
  } finally {
    gl.setRenderTarget(previous);
    restores.forEach((r) => r());
  }
  await ready;
  await finish(programs);
}

/** Runs once the browser has a quiet moment, after `delay` ms. Returns a cancel function. */
export function whenIdle(fn: () => void, delay = 0): () => void {
  let idle = 0;
  const start = setTimeout(() => {
    if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(fn, { timeout: 3000 });
    else idle = window.setTimeout(fn, 1500);
  }, delay);
  return () => {
    clearTimeout(start);
    if (typeof cancelIdleCallback === 'function') cancelIdleCallback(idle);
    clearTimeout(idle);
  };
}

/**
 * Compiles an object that isn't in the scene yet, exactly as a frame will draw it: into an off-screen buffer,
 * as the effect composer does (a program drawn to the screen differs in its output colour space), and under
 * the main scene's lights, fog and image light, or under none when `scene` is null. Non-blocking where KHR_parallel_shader_compile is available.
 * The programs stay cached for as long as some material still uses them.
 */
export async function compileOffscreen(gl: THREE.WebGLRenderer, object: THREE.Object3D, camera: THREE.Camera, scene: THREE.Scene | null): Promise<void> {
  offscreen ??= new THREE.WebGLRenderTarget(1, 1);
  const previous = gl.getRenderTarget();
  gl.setRenderTarget(offscreen);
  let ready: Promise<unknown>;
  try {
    // The programs' parameters are fixed during this call; only the wait for the driver is asynchronous.
    // Without a scene, as for a full-screen pass drawn on its own: no lights or shadows in its program.
    ready = scene ? gl.compileAsync(object, camera, scene) : gl.compileAsync(object, camera);
  } finally {
    gl.setRenderTarget(previous);
  }
  await ready;
  await finish(programsOf(gl, object));
}

/** The next idle moment, with how long it lasts. A timed-out wait (a busy page) leaves no time, so one program. */
const nextIdle = () =>
  new Promise<{ timeRemaining: () => number }>((resolve) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(resolve, { timeout: 3000 });
    else setTimeout(() => resolve({ timeRemaining: () => 8 }), 50);
  });

/**
 * Every program an object's materials compiled to. A transparent double-sided material (glass, sheers) is
 * drawn back faces first, then front, and holds a program for each, so all of them are taken, not just the last.
 */
function programsOf(gl: THREE.WebGLRenderer, object: THREE.Object3D): Set<Program> {
  const programs = new Set<Program>();
  object.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
      const props = gl.properties.get(mat) as { currentProgram?: Program; programs?: Map<string, Program> } | undefined;
      props?.programs?.forEach((p) => programs.add(p));
      if (props?.currentProgram) programs.add(props.currentProgram);
    }
  });
  return programs;
}

/**
 * Without KHR_parallel_shader_compile (several phone browsers), compileAsync returns at once and the driver
 * only compiles a program when it is first used, which would be the first frame inside the flat. Using
 * each one here, one per idle moment, does that work now in short slices. With the extension, or for a
 * program already drawn, it is free.
 */
async function finish(programs: Set<Program>): Promise<void> {
  const queue = [...programs];
  while (queue.length > 0) {
    const idle = await nextIdle();
    // As many as the moment allows: a program already drawn takes microseconds, one still to compile far longer.
    do queue.shift()!.getUniforms();
    while (queue.length > 0 && idle.timeRemaining() > 4);
  }
}
