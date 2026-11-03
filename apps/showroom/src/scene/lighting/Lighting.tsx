// Sun, sky, fog and image-based light, all driven by the time-of-day slider through the real sun position.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { blockById, interiors, outdoorSpotById, projectConfig, site, storeyY, sunAt, sunDirection, unitXform } from '@bair/project-data';
import type { Route } from '../../lib/routing';
import { useAppStore } from '../../store/useAppStore';
import { assetUrl, sceneUniforms, SUN_DIR } from '../shared';
import { consumeShadowUpdate, requestShadowUpdate } from './shadowControl';

// Where each HDRI's sun sits (u along the panorama), written by scripts/fetch-assets.mjs.
const DAY_SUN_U = 0.5951;
const NIGHT_SUN_U = 0.599;

const MOON_DIR = new THREE.Vector3(-0.42, 0.82, 0.38).normalize();
const DAY_FILL = new THREE.Color('#f6f0e6');

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const SKY_FRAG = /* glsl */ `
  uniform sampler2D uDay;
  uniform float uDayMix;
  uniform float uDayRot;
  uniform float uStars;
  uniform float uMoon;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform vec3 uFog;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  varying vec3 vDir;
  const float PI = 3.141592653;
  vec3 decode(vec3 v) {
    // Inverse of the bake in scripts/fetch-assets.mjs: Reinhard + gamma 2.2
    vec3 l = pow(clamp(v, 0.0, 0.995), vec3(2.2));
    return l / (1.0 - l);
  }
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
  }
  void main() {
    vec3 d = normalize(vDir);
    float a = atan(d.z, d.x) + uDayRot;
    vec2 uv = vec2(fract(a / (2.0 * PI) + 0.5), asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
    vec3 photo = decode(texture2D(uDay, uv).rgb);

    float up = clamp(d.y, 0.0, 1.0);
    vec3 grad = mix(uHorizon, uZenith, smoothstep(0.0, 0.42, pow(up, 0.8)));
    // Warm light around the sun, wider near the horizon.
    float toSun = max(dot(d, uSunDir), 0.0);
    grad += uGlow * (pow(toSun, 9.0) * 0.32 + pow(toSun, 64.0) * 0.9) * (1.0 - up * 0.6);
    // The photo's clouds, relit by the sky colour, keep dusk from looking like a flat gradient.
    float cloud = smoothstep(0.8, 1.7, dot(min(photo, vec3(2.0)), vec3(0.33))) * smoothstep(0.015, 0.16, d.y);
    grad = mix(grad, mix(uHorizon, uGlow * 1.2 + uHorizon * 0.5, 0.35 + 0.65 * toSun), cloud * 0.3);

    vec3 sky = mix(grad, photo * 0.92, uDayMix);

    if (uStars > 0.001 && d.y > 0.0) {
      vec3 cell = floor(d * 240.0);
      float s = hash(cell);
      float star = step(0.9965, s) * (0.4 + 0.6 * fract(s * 91.7));
      sky += vec3(0.85, 0.9, 1.0) * star * uStars * smoothstep(0.02, 0.3, d.y) * (1.0 - cloud * 0.8);
    }
    float moon = smoothstep(0.99955, 0.99975, dot(d, uMoonDir));
    sky += vec3(1.0, 0.97, 0.88) * moon * uMoon * 3.0;

    // Fade into the fog colour near the horizon so the ground meets the sky without a seam.
    gl_FragColor = vec4(mix(uFog, sky, smoothstep(-0.005, 0.1, d.y)), 1.0);
  }`;

interface SkyKey {
  alt: number;
  zenith: string;
  horizon: string;
  glow: string;
  fog: string;
  sun: string;
}

// Sky colours by sun altitude: night, blue hour, sunset, golden hour, day.
const KEYS: SkyKey[] = [
  { alt: -18, zenith: '#050913', horizon: '#111a2e', glow: '#000000', fog: '#131a2a', sun: '#000000' },
  { alt: -6, zenith: '#101d42', horizon: '#3c4772', glow: '#3a2b4a', fog: '#30395a', sun: '#000000' },
  { alt: 0, zenith: '#27407a', horizon: '#e98d5a', glow: '#ff7a34', fog: '#a98a84', sun: '#ff8a4a' },
  { alt: 7, zenith: '#3f6cab', horizon: '#f6bb84', glow: '#ff9a50', fog: '#d6b8a0', sun: '#ffac6c' },
  { alt: 22, zenith: '#4d86c8', horizon: '#e6dccb', glow: '#ffd9a8', fog: '#dcdad2', sun: '#ffe2bf' },
  { alt: 50, zenith: '#4a86cf', horizon: '#cfdfea', glow: '#fff1da', fog: '#d3dde4', sun: '#fff0dc' },
];

const colorKeys = KEYS.map((k) => ({
  alt: k.alt,
  zenith: new THREE.Color(k.zenith),
  horizon: new THREE.Color(k.horizon),
  glow: new THREE.Color(k.glow),
  fog: new THREE.Color(k.fog),
  sun: new THREE.Color(k.sun),
}));

function skyColor(field: 'zenith' | 'horizon' | 'glow' | 'fog' | 'sun', alt: number, out: THREE.Color) {
  const last = colorKeys.length - 1;
  if (alt <= colorKeys[0].alt) return out.copy(colorKeys[0][field]);
  if (alt >= colorKeys[last].alt) return out.copy(colorKeys[last][field]);
  for (let i = 0; i < last; i++) {
    const a = colorKeys[i];
    const b = colorKeys[i + 1];
    if (alt <= b.alt) return out.copy(a[field]).lerp(b[field], (alt - a.alt) / (b.alt - a.alt));
  }
  return out;
}

const smooth = THREE.MathUtils.smoothstep;

const isWindowSpot = (route: Extract<Route, { view: 'unit' }>): boolean => {
  const st = blockById(route.block)?.stacks.find((x) => x.stack === route.stack);
  return !!st && interiors[st.type].hotspots.find((h) => h.id === route.spot)?.kind === 'window';
};

const sunLocation = {
  latitude: projectConfig.location.latitude,
  longitude: projectConfig.location.longitude,
  timeZone: projectConfig.timeZone,
};

export function Lighting({ shadowSize, softShadows }: { shadowSize: number; softShadows: boolean }) {
  const { gl, scene } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const envIsNight = useRef(false);

  const [dayHdr, nightHdr] = useLoader(HDRLoader, [assetUrl('hdri/day.hdr'), assetUrl('hdri/night.hdr')]);
  const dayTex = useLoader(THREE.TextureLoader, assetUrl('hdri/sky_day.webp'));

  const envs = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    dayHdr.mapping = THREE.EquirectangularReflectionMapping;
    nightHdr.mapping = THREE.EquirectangularReflectionMapping;
    const day = pmrem.fromEquirectangular(dayHdr).texture;
    const night = pmrem.fromEquirectangular(nightHdr).texture;
    pmrem.dispose();
    return { day, night };
  }, [gl, dayHdr, nightHdr]);

  const skyUniforms = useMemo(() => {
    dayTex.colorSpace = THREE.NoColorSpace; // decoded by hand in the shader
    dayTex.wrapS = THREE.RepeatWrapping;
    dayTex.minFilter = THREE.LinearFilter;
    dayTex.generateMipmaps = false;
    return {
      uDay: { value: dayTex },
      uDayMix: { value: 0 },
      uDayRot: { value: 0 },
      uStars: { value: 0 },
      uMoon: { value: 0 },
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uFog: { value: new THREE.Color() },
      uSunDir: { value: SUN_DIR },
      uMoonDir: { value: MOON_DIR },
    };
  }, [dayTex]);

  useEffect(() => {
    scene.environment = envs.day;
    scene.fog = new THREE.FogExp2('#d3dde4', 0.00052);
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      scene.environment = null;
      scene.fog = null;
    };
  }, [scene, gl, envs]);

  // Shadow frustum: wide over the site, tight around a flat so its interior gets crisp shadows.
  const route = useAppStore((s) => s.route);
  const focus = useMemo(() => {
    if (route.view === 'unit') {
      const def = blockById(route.block)!;
      const xf = unitXform(def, def.stacks.find((s) => s.stack === route.stack)!);
      return { x: def.position[0] + xf.center[0], y: storeyY(route.storey), z: def.position[1] + xf.center[1], r: 20 };
    }
    if (route.view === 'floor') {
      const def = blockById(route.block)!;
      return { x: def.position[0], y: storeyY(route.storey), z: def.position[1], r: 70 };
    }
    if (route.view === 'outdoor') {
      const spot = outdoorSpotById(route.spot);
      if (spot) return { x: spot.x, y: 0, z: spot.z, r: 70 };
    }
    return { x: 0, y: 0, z: 0, r: 135 };
  }, [route]);

  // Where the directional light currently points from; the moon takes over after dark.
  const lightDir = useMemo(() => new THREE.Vector3(), []);
  const shadowDir = useRef(new THREE.Vector3(0, 0, 0));
  const placeLight = () => {
    const sun = sunRef.current;
    if (!sun) return;
    const cam = sun.shadow.camera;
    sun.target.position.set(focus.x, focus.y, focus.z);
    sun.target.updateMatrixWorld();
    sun.position.set(focus.x, focus.y, focus.z).addScaledVector(lightDir, 320);
    cam.left = -focus.r;
    cam.right = focus.r;
    cam.top = focus.r;
    cam.bottom = -focus.r;
    cam.near = 40;
    cam.far = 700;
    cam.updateProjectionMatrix();
    sun.shadow.normalBias = focus.r > 60 ? 0.35 : 0.04;
    sun.shadow.bias = focus.r > 60 ? -0.00015 : -0.0002;
    shadowDir.current.copy(lightDir);
    requestShadowUpdate();
  };
  useEffect(placeLight);

  const today = useMemo(() => new Date(), []);
  const scratch = useMemo(() => new THREE.Color(), []);

  useFrame((state, dt) => {
    const store = useAppStore.getState();
    if (store.playing) store.advanceTime(dt);

    const s = sunAt(store.time, sunLocation, today);
    const [dx, dy, dz] = sunDirection(s, site.northOffsetDeg);
    SUN_DIR.set(dx, dy, dz);
    const alt = s.altitude;

    // Artificial lights: windows from about an hour before sunset, full by the end of blue hour.
    const night = store.time < 12 * 60 ? 1 - smooth(alt, -6, 3) : 1 - smooth(alt, -5, 12);
    sceneUniforms.uNight.value = night;
    sceneUniforms.uTime.value = state.clock.elapsedTime;

    const sunUp = alt > -1;
    lightDir.copy(sunUp ? SUN_DIR : MOON_DIR);
    // Low suns barely move the picture, so shadows re-render only after a visible change.
    const threshold = store.playing ? 0.03 : 0.004;
    if (lightDir.distanceTo(shadowDir.current) > threshold) placeLight();

    const sun = sunRef.current;
    if (sun) {
      if (sunUp) {
        sun.intensity = 2.3 * smooth(alt, -1, 9);
        skyColor('sun', alt, sun.color);
      } else {
        sun.intensity = 0.2 * smooth(-alt, 2, 14);
        sun.color.set('#8ea6d8');
      }
    }
    if (hemiRef.current) {
      // By day, a strong neutral fill keeps walls their own colour when the sun moves off them.
      hemiRef.current.intensity = THREE.MathUtils.lerp(0.09, 0.95, smooth(alt, -8, 18));
      hemiRef.current.color.copy(skyColor('zenith', alt, scratch)).lerp(DAY_FILL, smooth(alt, 0, 22));
    }

    // Image-based light: swap to the night map where it is dimmest.
    const nowNightEnv = alt < -4;
    if (nowNightEnv !== envIsNight.current) {
      envIsNight.current = nowNightEnv;
      scene.environment = nowNightEnv ? envs.night : envs.day;
    }
    const envU = nowNightEnv ? NIGHT_SUN_U : DAY_SUN_U;
    const lightAngle = Math.atan2(SUN_DIR.z, SUN_DIR.x);
    const rotation = (envU - 0.5) * Math.PI * 2 - lightAngle;
    scene.environmentRotation.set(0, rotation, 0);
    scene.environmentIntensity = nowNightEnv
      ? 0.34 * smooth(-alt, 4, 12) + 0.03
      : 0.42 * smooth(alt, -4, 20) + 0.05;

    skyColor('zenith', alt, skyUniforms.uZenith.value);
    skyColor('horizon', alt, skyUniforms.uHorizon.value);
    skyColor('glow', alt, skyUniforms.uGlow.value);
    skyColor('fog', alt, skyUniforms.uFog.value);
    skyUniforms.uDayMix.value = smooth(alt, 10, 30);
    skyUniforms.uDayRot.value = (DAY_SUN_U - 0.5) * Math.PI * 2 - lightAngle;
    skyUniforms.uStars.value = smooth(-alt, 6, 16);
    skyUniforms.uMoon.value = smooth(-alt, 2, 10);
    if (scene.fog) (scene.fog as THREE.FogExp2).color.copy(skyUniforms.uFog.value);

    // Glass panels follow the scene: light text over dark skies, dark text over bright ones.
    const standing = store.route.view === 'unit' && store.route.spot !== undefined && !isWindowSpot(store.route);
    const mood = alt > 12 || standing ? 'bright' : 'dark';
    if (document.body.dataset.scene !== mood) document.body.dataset.scene = mood;

    if (consumeShadowUpdate()) gl.shadowMap.needsUpdate = true;
  });

  return (
    <>
      <directionalLight
        ref={sunRef}
        castShadow
        intensity={2.7}
        color="#fff0dc"
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-radius={softShadows ? 3.5 : 1.5}
      />
      <hemisphereLight ref={hemiRef} args={['#e8ecf0', '#a89a82', 0.42]} />
      <mesh scale={3800} frustumCulled={false} raycast={() => null} renderOrder={-10}>
        <sphereGeometry args={[1, 48, 32]} />
        <shaderMaterial vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} uniforms={skyUniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
    </>
  );
}
