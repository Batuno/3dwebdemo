// PBR material library. Textures are CC0 (see ASSETS.md); UVs across the scene are in metres,
// so each texture's repeat is 1 / (metres it covers).
import { useMemo } from 'react';
import * as THREE from 'three';
import { useKTX2 } from '@react-three/drei';
import { projectConfig } from '@bair/project-data';
import { tiered } from './assetTier';
import { addWorldPos, assetUrl, basisPath, NOISE_GLSL, sceneUniforms } from './shared';

type MapKind = 'color' | 'normal' | 'rough';
const ALL: readonly MapKind[] = ['color', 'normal', 'rough'];

/** Textures the site needs for its first frame, and only the maps something actually uses. */
const SITE_MAPS = {
  grass: ALL,
  asphalt: ALL,
  paving: ALL,
  concrete: ALL,
  plaster: ['normal', 'rough'],
  rubber: ['normal', 'rough'],
  bark: ALL,
  wood: ALL,
} as const satisfies Record<string, readonly MapKind[]>;

/** Used only inside flats: fetched once the page is idle, or when a flat opens, whichever comes first. */
const INTERIOR_MAPS = {
  woodfloor: ALL,
  tile: ALL,
  fabric: ['normal'],
  carpet: ['normal'],
} as const satisfies Record<string, readonly MapKind[]>;

type SiteSet = keyof typeof SITE_MAPS;
type InteriorSet = keyof typeof INTERIOR_MAPS;
type SetName = SiteSet | InteriorSet;

// Phones get the same textures one mip level down: a quarter of the download, and no visible loss at
// their size and pixel ratio. The files are made at build time (vite.config.ts, src/lib/ktx2Lite.ts).
const textureUrl = (name: string) => assetUrl(tiered(`textures/${name}.ktx2`));
const FILE: Record<MapKind, string> = { color: 'color', normal: 'normal', rough: 'rough' };

const urlsFor = (maps: Record<string, readonly MapKind[]>) =>
  Object.entries(maps).flatMap(([set, kinds]) => kinds.map((k) => textureUrl(`${set}_${FILE[k]}`)));

const siteUrls: string[] = [...urlsFor(SITE_MAPS), textureUrl('leaves_color')];
const interiorUrls: string[] = urlsFor(INTERIOR_MAPS);

/** metres covered by one texture repeat */
const TILE: Record<SetName, number> = {
  grass: 3.2,
  asphalt: 4,
  paving: 2.4,
  concrete: 3,
  plaster: 2.5,
  woodfloor: 2.2,
  tile: 1.2,
  fabric: 0.7,
  carpet: 1.4,
  rubber: 1.5,
  bark: 1.2,
  wood: 1.2,
};

/** The maps of one material set; only the ones in use are loaded. */
export interface PbrSet {
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
}

const SLOT: Record<MapKind, keyof PbrSet> = { color: 'map', normal: 'normalMap', rough: 'roughnessMap' };

function prepare(t: THREE.Texture, tile: number, srgb: boolean, aniso: number) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tile, 1 / tile);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/** Panel-joint normal map: one 1.4 × 2.8 m facade panel with a groove around it. */
function makeJointNormal(): THREE.Texture {
  const W = 128;
  const H = 256;
  const data = new Uint8Array(W * H * 4);
  const groove = 3;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let nx = 0;
      let ny = 0;
      if (x < groove) nx = 1;
      else if (x >= W - groove) nx = -1;
      if (y < groove) ny = 1;
      else if (y >= H - groove) ny = -1;
      const o = (y * W + x) * 4;
      data[o] = 128 + nx * 110;
      data[o + 1] = 128 + ny * 110;
      data[o + 2] = 255 - (Math.abs(nx) + Math.abs(ny)) * 60;
      data[o + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 1.4, 1 / 2.8);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** Tone varies panel by panel, and at night a warm uplight washes the lower facade. */
function patchFacade(m: THREE.MeshStandardMaterial, amount: number, uplight: number) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = sceneUniforms.uNight;
    addWorldPos(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uNight;\n${NOISE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 panelId = floor(vec2(vWPos.x + vWPos.z, vWPos.y) / vec2(1.4, 2.8));
          diffuseColor.rgb *= 1.0 + (hash21(panelId) - 0.5) * ${amount.toFixed(3)};
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float low = smoothstep(14.0, 0.0, vWPos.y);
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.72, 0.42) * low * ${uplight.toFixed(3)} * uNight;
        }`,
      );
  };
  m.customProgramCacheKey = () => `facade-${amount}-${uplight}`;
}

/** Ground-scale colour drift so large areas never show a visibly repeating tile. */
function patchMacro(m: THREE.MeshStandardMaterial, a: string, b: string, scale: number, strength: number) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uMacroA = { value: ca };
    shader.uniforms.uMacroB = { value: cb };
    addWorldPos(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uMacroA; uniform vec3 uMacroB;\n${NOISE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float n = fbm2(vWPos.xz * ${scale.toFixed(4)});
          float fine = vnoise(vWPos.xz * ${(scale * 6).toFixed(4)});
          diffuseColor.rgb *= mix(vec3(1.0), mix(uMacroA, uMacroB, n), ${strength.toFixed(3)});
          diffuseColor.rgb *= 0.92 + fine * 0.16;
        }`,
      );
  };
  m.customProgramCacheKey = () => `macro-${a}-${b}-${scale}-${strength}`;
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);

/** Textures in the order urlsFor() listed them, sorted into their sets. */
function buildSets<K extends SetName>(maps: Record<K, readonly MapKind[]>, tex: THREE.Texture[], aniso: number) {
  const sets = {} as Record<K, PbrSet>;
  let i = 0;
  for (const name of Object.keys(maps) as K[]) {
    const set: PbrSet = {};
    for (const kind of maps[name]) set[SLOT[kind]] = prepare(tex[i++], TILE[name], kind === 'color', aniso);
    sets[name] = set;
  }
  return { sets, used: i };
}

function buildLibrary(tex: THREE.Texture[], aniso: number) {
  const { sets, used } = buildSets(SITE_MAPS, tex, aniso);
  const leafMap = tex[used];
  leafMap.colorSpace = THREE.SRGBColorSpace;
  leafMap.anisotropy = aniso;

  const pal = projectConfig.facade;
  const joint = makeJointNormal();
  const plasterRough = sets.plaster.roughnessMap;

  const panel = (color: string, roughness: number, amount: number, uplight: number) => {
    const m = std({
      color,
      roughness,
      roughnessMap: plasterRough,
      normalMap: joint,
      normalScale: new THREE.Vector2(0.6, 0.6),
    });
    patchFacade(m, amount, uplight);
    return m;
  };

  const facade = {
    panelLight: panel(pal.panelLight, 0.95, 0.05, 1.1),
    panelMid: panel(pal.panelMid, 0.95, 0.05, 0.7),
    warm: panel(pal.warmAccent, 0.78, 0.08, 0.8),
    bronze: panel(pal.bronze, 0.52, 0.06, 0.7),
    teal: std({ color: pal.spandrelTeal, roughness: 0.32, metalness: 0.15 }),
    gold: std({ color: pal.gold, roughness: 0.32, metalness: 0.9 }),
    frame: std({ color: pal.frame, roughness: 0.42, metalness: 0.65 }),
    slab: std({ color: '#d2d0ca', roughness: 0.9 }),
    concrete: std({ color: '#d9d6cf', roughness: 0.82, ...sets.concrete, map: undefined }),
    lamp: new THREE.MeshStandardMaterial({ color: '#f7f2e6', roughness: 0.6, emissive: '#ffd9a0', emissiveIntensity: 0 }),
    roofGreen: std({ ...sets.grass, color: '#a9c58d', roughness: 1 }),
    glassShop: new THREE.MeshPhysicalMaterial({
      color: '#28373a',
      roughness: 0.06,
      metalness: 0.1,
      envMapIntensity: 1.4,
    }),
  };

  const grass = std({ ...sets.grass, color: '#c3c9a2', roughness: 1 });
  patchMacro(grass, '#8d9a62', '#c8c98f', 0.035, 0.75);
  const asphalt = std({ ...sets.asphalt, color: '#a6a5a4', roughness: 0.95 });
  patchMacro(asphalt, '#8f8e8d', '#b5b3b0', 0.05, 0.5);
  const paving = std({ ...sets.paving, color: '#d9d4ca', roughness: 0.92 });
  patchMacro(paving, '#c1bcb1', '#ece7dc', 0.06, 0.4);
  const sidewalk = std({ ...sets.concrete, color: '#c9c6bf', roughness: 0.95 });
  const curb = std({ color: '#bdbbb5', roughness: 0.9, normalMap: sets.concrete.normalMap, roughnessMap: sets.concrete.roughnessMap });
  const concrete = std({ ...sets.concrete, color: '#cfccc4', roughness: 0.9 });
  const rubber = std({ ...sets.rubber, map: undefined, roughness: 0.9, color: '#ffffff' });

  for (const [k, m] of Object.entries(facade)) m.name = `M_Facade_${k}`;
  grass.name = 'M_Grass';
  asphalt.name = 'M_Asphalt';
  paving.name = 'M_Paving';
  sidewalk.name = 'M_Sidewalk';
  curb.name = 'M_Curb';
  concrete.name = 'M_Concrete';
  rubber.name = 'M_Rubber';

  return { sets, facade, grass, asphalt, paving, sidewalk, curb, concrete, rubber, leafMap };
}

export type MaterialLibrary = ReturnType<typeof buildLibrary>;

let cached: MaterialLibrary | null = null;

/** Suspends until every site texture is transcoded; afterwards the same materials are shared. */
export function useMaterials(): MaterialLibrary {
  const tex = useKTX2(siteUrls, basisPath()) as THREE.Texture[];
  return useMemo(() => {
    if (!cached) cached = buildLibrary(tex, 8);
    return cached;
  }, [tex]);
}

let interiorCached: Record<InteriorSet, PbrSet> | null = null;

/** The texture sets used only inside flats. Suspends while they load; prefetched when the page is idle. */
export function useInteriorSets(): Record<InteriorSet, PbrSet> {
  const tex = useKTX2(interiorUrls, basisPath()) as THREE.Texture[];
  return useMemo(() => {
    interiorCached ??= buildSets(INTERIOR_MAPS, tex, 8).sets;
    return interiorCached;
  }, [tex]);
}
