// Sun, sky, fog and image-based light, all driven by the time-of-day slider through the real sun position.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { blockById, interiors, outdoorSpotById, projectConfig, site, storeyY, sunAt, sunDirection, unitXform } from '@bair/project-data';
import type { Route } from '../../lib/routing';
import { useAppStore } from '../../store/useAppStore';
import { assetUrl, sceneUniforms, SUN_DIR } from '../shared';
import { consumeShadowUpdate, requestShadowUpdate } from './shadowControl';
import { tiered } from '../assetTier';

// Where each HDRI's sun sits (u along the panorama), written by scripts/fetch-assets.mjs.
const DAY_SUN_U = 0.5951;
const NIGHT_SUN_U = 0.599;

const MOON_DIR = new THREE.Vector3(-0.42, 0.82, 0.38).normalize();
const DAY_FILL = new THREE.Color('#f6f0e6');
const HEMI_GROUND = new THREE.Color('#a89a82');
// Fill for the open garage, added to the sky light instead of mounting a light of its own:
// a light count change would recompile every material in the scene.
const GARAGE_SKY = new THREE.Color('#fff4e3').multiplyScalar(1.3);
const GARAGE_GROUND = new THREE.Color('#6c6a66').multiplyScalar(1.3);

const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** Bigger jumps than this, in minutes, cut straight to the new time instead of sweeping across the day. */
const GLIDE_LIMIT = 6 * 60;

// Phones get half-size image lights (see assetTier). Both maps must stay the same size: the prefiltered
// map's size is part of every material's shader, so a mismatch would recompile them all on the swap.
const DAY_HDR = tiered('hdri/day.hdr');
const NIGHT_HDR = tiered('hdri/night.hdr');

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
  { alt: 22, zenith: '#4d86c8', horizon: '#e6dccb', glow: '#ffd9a8', fog: '#d4d8d8', sun: '#ffe2bf' },
  { alt: 50, zenith: '#4a86cf', horizon: '#cfdfea', glow: '#fff1da', fog: '#c8d6e1', sun: '#fff0dc' },
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

function prefilter(gl: THREE.WebGLRenderer, hdr: THREE.Texture): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(gl);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const env = pmrem.fromEquirectangular(hdr).texture;
  pmrem.dispose();
  return env;
}

/** The image light the opening time doesn't need, loaded once it is needed or the page is idle. */
function LateEnv({ url, onReady }: { url: string; onReady: (env: THREE.Texture) => void }) {
  const gl = useThree((s) => s.gl);
  const hdr = useLoader(HDRLoader, url);
  useEffect(() => onReady(prefilter(gl, hdr)), [gl, hdr, onReady]);
  return null;
}

const altitudeAt = (minutes: number) => sunAt(minutes, sunLocation, new Date()).altitude;
/** The night image light takes over below this sun altitude, in degrees. */
const NIGHT_ENV_BELOW = -4;

// Daytime balance. The sun against the fill sets how far a shaded face drops below a lit one:
// about 5:1 here, enough to read each wing's shape without the shaded side going dark.
const SUN_DAY = 2.75;
const FILL_DAY = 0.55;
/** Sky image light by day: blue fill in the shade and reflections in glass and floors. */
const SKY_DAY = 0.6;

export function Lighting({ shadowSize, softShadows }: { shadowSize: number; softShadows: boolean }) {
  const { gl, scene } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);

  // The first frame only needs the image light for the opening time (the default dusk start is the
  // night one); the other loads later. Around twilight, both.
  const start = useMemo(() => {
    const alt = altitudeAt(useAppStore.getState().time);
    return { day: alt > NIGHT_ENV_BELOW - 3, night: alt < NIGHT_ENV_BELOW + 5 };
  }, []);
  const hdrs = useLoader(HDRLoader, [...(start.day ? [assetUrl(DAY_HDR)] : []), ...(start.night ? [assetUrl(NIGHT_HDR)] : [])]);
  const dayTex = useLoader(THREE.TextureLoader, assetUrl('hdri/sky_day.webp'));

  const envs = useMemo(() => {
    const day = start.day ? prefilter(gl, hdrs[0]) : null;
    const night = start.night ? prefilter(gl, hdrs[start.day ? 1 : 0]) : null;
    return { day, night };
  }, [gl, hdrs, start]);
  const dayEnv = useRef<THREE.Texture | null>(null);
  const nightEnv = useRef<THREE.Texture | null>(null);
  dayEnv.current ??= envs.day;
  nightEnv.current ??= envs.night;
  const lateUrl = envs.day && envs.night ? null : assetUrl(envs.day ? NIGHT_HDR : DAY_HDR);
  const [wantLate, setWantLate] = useState(false);
  const sceneReady = useAppStore((s) => s.sceneReady);
  useEffect(() => {
    if (!sceneReady || !lateUrl) return undefined;
    const id = setTimeout(() => setWantLate(true), 4000);
    return () => clearTimeout(id);
  }, [sceneReady, lateUrl]);
  const onLate = useMemo(
    () => (env: THREE.Texture) => {
      if (envs.day) nightEnv.current = env;
      else dayEnv.current = env;
    },
    [envs],
  );

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
    scene.environment = envs.day ?? envs.night;
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
  const garageMix = useRef(useAppStore.getState().route.view === 'garage' ? 1 : 0);
  // The light follows the slider with a short glide, so a drag never snaps the sun and sky.
  const displayTime = useRef(useAppStore.getState().time);

  useFrame((state, dt) => {
    const store = useAppStore.getState();
    if (store.playing) store.advanceTime(dt);

    const gap = store.time - displayTime.current;
    const snapTime = reduceMotion || store.playing || Math.abs(gap) > GLIDE_LIMIT;
    displayTime.current = snapTime ? store.time : THREE.MathUtils.damp(displayTime.current, store.time, 3, dt);
    if (Math.abs(store.time - displayTime.current) < 0.05) displayTime.current = store.time;
    const gliding = displayTime.current !== store.time;

    const s = sunAt(displayTime.current, sunLocation, today);
    const [dx, dy, dz] = sunDirection(s, site.northOffsetDeg);
    SUN_DIR.set(dx, dy, dz);
    const alt = s.altitude;

    // Artificial lights: windows from about an hour before sunset, full by the end of blue hour.
    const night = displayTime.current < 12 * 60 ? 1 - smooth(alt, -6, 3) : 1 - smooth(alt, -5, 12);
    sceneUniforms.uNight.value = night;
    sceneUniforms.uTime.value = state.clock.elapsedTime;

    const sunUp = alt > -1;
    lightDir.copy(sunUp ? SUN_DIR : MOON_DIR);
    // Low suns barely move the picture, so shadows re-render only after a visible change.
    const threshold = store.playing || gliding ? 0.03 : 0.004;
    if (lightDir.distanceTo(shadowDir.current) > threshold) placeLight();

    const sun = sunRef.current;
    if (sun) {
      if (sunUp) {
        sun.intensity = SUN_DAY * smooth(alt, -1, 9);
        skyColor('sun', alt, sun.color);
      } else {
        sun.intensity = 0.2 * smooth(-alt, 2, 14);
        sun.color.set('#8ea6d8');
      }
    }
    const hemi = hemiRef.current;
    if (hemi) {
      // By day, a neutral fill keeps walls their own colour when the sun moves off them, without
      // lifting the shaded side so far that the towers lose their shape.
      hemi.intensity = THREE.MathUtils.lerp(0.09, FILL_DAY, smooth(alt, -8, 18));
      hemi.color.copy(skyColor('zenith', alt, scratch)).lerp(DAY_FILL, smooth(alt, 0, 22));
      hemi.groundColor.copy(HEMI_GROUND);
      const inGarage = store.route.view === 'garage' ? 1 : 0;
      garageMix.current = reduceMotion ? inGarage : THREE.MathUtils.damp(garageMix.current, inGarage, 4, dt);
      if (Math.abs(garageMix.current - inGarage) < 0.002) garageMix.current = inGarage;
      const g = garageMix.current;
      if (g > 0) {
        // Same light as the day fill plus the garage fill, folded into one hemisphere light.
        hemi.color.multiplyScalar(hemi.intensity).add(scratch.copy(GARAGE_SKY).multiplyScalar(g));
        hemi.groundColor.multiplyScalar(hemi.intensity).add(scratch.copy(GARAGE_GROUND).multiplyScalar(g));
        hemi.intensity = 1;
      }
    }

    // Image-based light: swap to the night map where it is dimmest.
    // Fetch the missing map as the sun approaches its range, if idle time hasn't already.
    if (lateUrl && !wantLate && (envs.day ? alt < NIGHT_ENV_BELOW + 6 : alt > NIGHT_ENV_BELOW - 4)) setWantLate(true);
    const nowNightEnv = alt < NIGHT_ENV_BELOW;
    const env = nowNightEnv ? (nightEnv.current ?? dayEnv.current) : (dayEnv.current ?? nightEnv.current);
    if (scene.environment !== env) scene.environment = env;
    const envU = env === nightEnv.current ? NIGHT_SUN_U : DAY_SUN_U;
    const lightAngle = Math.atan2(SUN_DIR.z, SUN_DIR.x);
    const rotation = (envU - 0.5) * Math.PI * 2 - lightAngle;
    scene.environmentRotation.set(0, rotation, 0);
    scene.environmentIntensity = nowNightEnv
      ? 0.34 * smooth(-alt, 4, 12) + 0.03
      : SKY_DAY * smooth(alt, -4, 20) + 0.05;

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
    // The floor plan's backdrop is light paper at any hour, so it counts as bright too.
    const standing = store.route.view === 'unit' && store.route.spot !== undefined && !isWindowSpot(store.route);
    const plan = store.route.view === 'unit' && store.planMode;
    const mood = alt > 12 || standing || plan ? 'bright' : 'dark';
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
      {wantLate && lateUrl && (
        <Suspense fallback={null}>
          <LateEnv url={lateUrl} onReady={onLate} />
        </Suspense>
      )}
      <mesh scale={3800} frustumCulled={false} raycast={() => null} renderOrder={-10}>
        <sphereGeometry args={[1, 48, 32]} />
        <shaderMaterial vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} uniforms={skyUniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
    </>
  );
}
