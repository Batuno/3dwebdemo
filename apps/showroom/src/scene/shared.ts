import * as THREE from 'three';
import { projectConfig } from '@bair/project-data';

/** Uniforms shared by every patched material. Updated once per frame. */
export const sceneUniforms = {
  uTime: { value: 0 },
  /** 0 = day, 1 = night. */
  uNight: { value: 0 },
};

export const assetUrl = (p: string): string => `${projectConfig.assetBaseUrl || import.meta.env.BASE_URL}assets/${p}`;
export const basisPath = (): string => `${import.meta.env.BASE_URL}basis/`;

/** Pointer travel, in pixels, beyond which a press counts as a camera drag rather than a click. */
export const CLICK_SLOP = 6;

/** Toward the sun, in site space. Lighting.tsx rewrites it from the time of day every frame. */
export const SUN_DIR = new THREE.Vector3(0.78, 1.72, 0.46).normalize();

type ShaderArg = Parameters<NonNullable<THREE.Material['onBeforeCompile']>>[0];

/** Adds a vWPos varying (world position), instancing aware. Idempotent per shader. */
export function addWorldPos(shader: ShaderArg) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      {
        vec4 wp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        vWPos = (modelMatrix * wp).xyz;
      }`,
    );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    '#include <common>\nvarying vec3 vWPos;',
  );
}

export const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x),
               mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm2(vec2 p) {
    return 0.6 * vnoise(p) + 0.3 * vnoise(p * 2.1 + 3.1) + 0.1 * vnoise(p * 4.3 + 7.7);
  }
`;

export const damp = THREE.MathUtils.damp;
