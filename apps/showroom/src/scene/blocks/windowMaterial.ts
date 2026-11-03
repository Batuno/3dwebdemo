import * as THREE from 'three';
import { projectConfig } from '@bair/project-data';
import { sceneUniforms } from '../shared';

// Glass with "interior mapping": each pane ray-marches a fake room box behind it, so you see
// parallax rooms, curtains and lit windows without any interior geometry. Reflections come
// from the normal PBR env lookup, on top.
export function makeWindowMaterial(detailed: boolean): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    name: 'M_Glass',
    color: '#0c1416',
    roughness: 0.06,
    metalness: 0,
    ior: 1.55,
    envMapIntensity: 1.35,
    specularIntensity: 1,
    specularColor: new THREE.Color(projectConfig.facade.glassTint),
  });
  const tint = new THREE.Color(projectConfig.facade.glassTint);
  m.userData.uHighlight = { value: new THREE.Vector2(-1000, -1000) };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = sceneUniforms.uNight;
    shader.uniforms.uTint = { value: tint };
    shader.uniforms.uHighlight = m.userData.uHighlight;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aSeed;
        attribute vec2 aSize;
        varying vec3 vRoomPos;
        varying vec3 vRoomDir;
        varying float vSeed;
        varying vec2 vSize;
        varying float vInstY;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          mat4 im = modelMatrix * instanceMatrix;
          vec3 camL = (inverse(im) * vec4(cameraPosition, 1.0)).xyz;
          vec3 scale = vec3(aSize, 1.0);
          vRoomPos = vec3(position.xy, 0.0) * scale;
          vRoomDir = vRoomPos - camL * scale;
          vSeed = aSeed;
          vSize = aSize;
          vInstY = im[3][1];
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNight;
        uniform vec3 uTint;
        uniform vec2 uHighlight;
        varying float vInstY;
        varying vec3 vRoomPos;
        varying vec3 vRoomDir;
        varying float vSeed;
        varying vec2 vSize;
        vec3 roomColor(vec3 ro, vec3 rd, float seed, vec2 size, float lit) {
          vec2 hw = vec2(max(1.5, size.x * 0.8), 0.0);
          float depth = 3.0 + fract(seed * 7.13) * 1.6;
          float floorY = -size.y * 0.5 - 0.55;
          float ceilY = floorY + 2.6;
          vec3 rmin = vec3(-hw.x, floorY, -depth);
          vec3 rmax = vec3(hw.x, ceilY, 0.5);
          vec3 inv = 1.0 / rd;
          vec3 t1 = (rmin - ro) * inv;
          vec3 t2 = (rmax - ro) * inv;
          vec3 tm = max(t1, t2);
          float t = min(min(tm.x, tm.y), tm.z);
          vec3 hit = ro + rd * t;
          float wallHue = fract(seed * 13.7);
          vec3 wall = mix(vec3(0.82, 0.78, 0.70), vec3(0.72, 0.76, 0.74), wallHue);
          vec3 col;
          if (tm.y < tm.x && tm.y < tm.z) {
            if (rd.y < 0.0) {
              // Wood floor with plank lines
              float plank = fract(hit.x * 2.2 + floor(hit.z * 0.6) * 0.37);
              col = vec3(0.46, 0.33, 0.22) * (0.85 + 0.15 * step(0.04, plank));
            } else {
              col = vec3(0.92, 0.91, 0.88);
            }
          } else if (tm.x < tm.z) {
            col = wall * 0.88;
          } else {
            col = wall;
            // Cabinet or sofa silhouette along the back wall
            float piece = step(abs(hit.x - (fract(seed * 3.3) - 0.5) * 1.6), 0.8 + fract(seed * 5.1) * 0.5);
            float tall = floorY + 0.55 + fract(seed * 9.1) * 1.3;
            if (piece > 0.5 && hit.y < tall) col = mix(vec3(0.22, 0.2, 0.18), vec3(0.42, 0.36, 0.3), wallHue);
          }
          // Light falls off away from the ceiling lamp
          float lamp = 1.0 - clamp(length(hit - vec3(0.0, ceilY, -depth * 0.5)) / 4.2, 0.0, 1.0);
          return col * mix(0.55 + hit.y * 0.08, 0.2 + lamp * lamp * 1.6, lit);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          ${
            detailed
              ? `
          vec3 ro = vRoomPos;
          vec3 rd = normalize(vRoomDir);
          float s = vSeed;
          float lit = step(0.56, fract(s * 91.7));
          vec3 room = roomColor(ro, rd, s, vSize, lit);

          // Curtains hang a little behind the glass
          float tc = -0.14 / rd.z;
          vec2 pc = ro.xy + rd.xy * tc;
          float open = 0.16 + fract(s * 17.3) * 0.34;
          float edge = abs(pc.x) / (vSize.x * 0.5);
          float curtain = smoothstep(1.0 - open, 1.0 - open + 0.03, edge);
          float folds = 0.82 + 0.18 * sin(pc.x * 26.0 + s * 40.0);
          // Some flats keep a roller blind half down instead
          float blindOn = step(0.72, fract(s * 29.1));
          float blind = blindOn * smoothstep(0.0, 0.02, pc.y - (vSize.y * 0.5 - vSize.y * (0.2 + 0.5 * fract(s * 37.0))));
          vec3 cloth = mix(vec3(0.84, 0.81, 0.74), vec3(0.6, 0.58, 0.52), fract(s * 11.0)) * folds;
          float cover = max(curtain, blind);

          vec3 dayCol = mix(room * 0.42, cloth * 0.62, cover);
          vec3 warm = vec3(1.0, 0.76, 0.48);
          vec3 nightCol = lit > 0.5
            ? mix(room * warm * 2.3, cloth * warm * 2.5, cover)
            : mix(room * 0.012, cloth * 0.02, cover);
          vec3 inside = mix(dayCol, nightCol, uNight);
          totalEmissiveRadiance += inside * mix(uTint, vec3(1.0), 0.35 + 0.45 * uNight);
          `
              : `
          float s = vSeed;
          float lit = step(0.56, fract(s * 91.7));
          vec3 warm = vec3(1.0, 0.76, 0.48);
          vec3 dayCol = mix(vec3(0.14, 0.17, 0.17), vec3(0.34, 0.33, 0.3), step(0.6, fract(s * 13.0)));
          totalEmissiveRadiance += mix(dayCol, lit * warm * 1.5 + vec3(0.01), uNight);
          `
          }
          if (vInstY > uHighlight.x && vInstY < uHighlight.y) {
            totalEmissiveRadiance = max(totalEmissiveRadiance, vec3(1.0, 0.76, 0.48) * 1.9);
          }
        }`,
      );
  };
  m.customProgramCacheKey = () => `window-${detailed}`;
  return m;
}
