import * as THREE from 'three';

// Warm room lights that only interior materials pay for. Real THREE point lights would force every
// material in the whole site to recompile when a flat opens, which stalls the frame for seconds.
export const MAX_ROOM_LIGHTS = 8;

export const roomLights = {
  /** View-space positions, written once per frame by UnitInterior. */
  uRoomLightPos: { value: Array.from({ length: MAX_ROOM_LIGHTS }, () => new THREE.Vector3()) },
  /** rgb = colour × intensity, a is packed into uRoomLightInvRad. */
  uRoomLightCol: { value: Array.from({ length: MAX_ROOM_LIGHTS }, () => new THREE.Color(0, 0, 0)) },
  uRoomLightInvRad: { value: new Array<number>(MAX_ROOM_LIGHTS).fill(1) },
  /** Warm bounce light: stands in for the light that fills a real room. */
  uRoomFill: { value: new THREE.Color(0.2, 0.17, 0.13) },
};

export function applyRoomLights(m: THREE.Material): void {
  if (m.userData.roomLit) return;
  m.userData.roomLit = true;
  const previous = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    previous.call(m, shader, renderer);
    shader.uniforms.uRoomLightPos = roomLights.uRoomLightPos;
    shader.uniforms.uRoomLightCol = roomLights.uRoomLightCol;
    shader.uniforms.uRoomLightInvRad = roomLights.uRoomLightInvRad;
    shader.uniforms.uRoomFill = roomLights.uRoomFill;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uRoomLightPos[${MAX_ROOM_LIGHTS}];
        uniform vec3 uRoomLightCol[${MAX_ROOM_LIGHTS}];
        uniform float uRoomLightInvRad[${MAX_ROOM_LIGHTS}];
        uniform vec3 uRoomFill;`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        {
          vec3 roomSum = vec3(0.0);
          for (int i = 0; i < ${MAX_ROOM_LIGHTS}; i++) {
            vec3 toL = uRoomLightPos[i] + vViewPosition;
            float d2 = dot(toL, toL);
            float k = uRoomLightInvRad[i];
            float a = max(1.0 - d2 * k * k, 0.0);
            float nl = dot(normal, toL) * inversesqrt(max(d2, 0.0001)) * 0.65 + 0.35;
            roomSum += uRoomLightCol[i] * a * a * max(nl, 0.0);
          }
          reflectedLight.directDiffuse += (roomSum * RECIPROCAL_PI + uRoomFill) * material.diffuseColor;
        }`,
      );
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => `room-${key ? key() : ''}`;
  m.needsUpdate = true;
}
