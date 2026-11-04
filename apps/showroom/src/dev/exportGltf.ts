// Dev tool behind the #/dev/export page. Lazily loaded in development only, so it isn't bundled.
// Bakes the live scene into plain meshes and PBR materials an external engine can read:
// instances are expanded, custom shaders are replaced with their closest PBR values.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { decompress } from 'three/examples/jsm/utils/WebGLTextureUtils.js';
import {
  blockById,
  blocks,
  camerasJson,
  hotspotsJson,
  interiors,
  interiorsJson,
  site,
  storeyY,
  sunJson,
  topviewPropsJson,
  unitNumber,
  unitsCsv,
  unitXform,
} from '@bair/project-data';
import { shotFor } from '../scene/camera/CameraRig';
import { useAppStore } from '../store/useAppStore';

type StdMat = THREE.MeshStandardMaterial;

const win = window as unknown as {
  __renderer: THREE.WebGLRenderer;
  __scene: THREE.Scene;
};

/* ---------- Materials ---------- */

// Texture repeats are baked into the UVs, because KHR_texture_transform support varies by engine.
const repeats = new Map<THREE.Texture, THREE.Vector2>();
const repeatOf = (tex: THREE.Texture): THREE.Vector2 => {
  let r = repeats.get(tex);
  if (!r) {
    r = tex.repeat.clone();
    repeats.set(tex, r);
  }
  return r;
};
const sameRepeat = (a: THREE.Texture, b: THREE.Texture) => repeatOf(a).equals(repeatOf(b));

// The exporter draws normal maps to a canvas, so raw data textures (the panel joints) need one first.
const readableCache = new Map<THREE.Texture, THREE.Texture>();
function readable(tex: THREE.Texture | null | undefined): THREE.Texture | null {
  if (!tex) return null;
  if (!(tex as THREE.DataTexture).isDataTexture) return tex;
  let out = readableCache.get(tex);
  if (!out) {
    const { data, width, height } = tex.image as { data: Uint8Array; width: number; height: number };
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
    out = new THREE.CanvasTexture(canvas);
    out.wrapS = out.wrapT = THREE.RepeatWrapping;
    out.flipY = false;
    out.colorSpace = tex.colorSpace;
    repeats.set(out, repeatOf(tex));
    readableCache.set(tex, out);
  }
  return out;
}

const signature = (m: StdMat) =>
  [
    m.name,
    m.color?.getHexString(),
    m.map?.uuid,
    m.normalMap?.uuid,
    m.roughnessMap?.uuid,
    m.metalnessMap?.uuid,
    m.roughness,
    m.metalness,
    m.alphaTest,
    m.opacity,
    m.side,
  ].join('|');

interface Converted {
  material: StdMat;
  /** UV scale that replaces the texture repeat. */
  uvScale: THREE.Vector2;
}

const converted = new Map<string, Converted>();

function convert(src: THREE.Material): Converted {
  const s = src as StdMat;
  const key = signature(s);
  const hit = converted.get(key);
  if (hit) return hit;

  const name = s.name || `M_${s.color?.getHexString() ?? 'default'}`;
  let result: Converted;

  if (name === 'M_Glass' && !s.transparent) {
    // The app's interior-mapped glass is a custom shader; opaque dark glass keeps towers from looking hollow.
    result = {
      material: new THREE.MeshStandardMaterial({ name, color: '#1f3336', roughness: 0.06, metalness: 0.1 }),
      uvScale: new THREE.Vector2(1, 1),
    };
  } else if ((src as THREE.Material & { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial) {
    const color = (src as THREE.MeshBasicMaterial).color.clone();
    const peak = Math.max(color.r, color.g, color.b, 1);
    color.multiplyScalar(1 / peak);
    result = {
      material: new THREE.MeshStandardMaterial({ name, color: '#000000', emissive: color, emissiveIntensity: 1 }),
      uvScale: new THREE.Vector2(1, 1),
    };
  } else {
    const ref = s.map ?? s.normalMap ?? s.roughnessMap;
    const uvScale = ref ? repeatOf(ref).clone() : new THREE.Vector2(1, 1);
    const fits = (tex: THREE.Texture | null | undefined) => (tex && ref && sameRepeat(tex, ref) ? tex : null);
    const emissiveOn = name !== 'M_Ceiling' && !!s.emissive && s.emissive.getHex() !== 0;
    const material = new THREE.MeshStandardMaterial({
      name,
      color: name === 'M_Context' ? '#cfcabf' : name === 'M_CityGround' ? '#8d917b' : s.color,
      map: s.map ?? null,
      normalMap: fits(readable(s.normalMap)),
      normalScale: s.normalScale,
      // Facade panels mix tile sizes in the app. A shared UV can only serve one of them.
      roughnessMap: fits(s.roughnessMap),
      metalnessMap: fits(s.metalnessMap),
      roughness: s.roughness ?? 0.8,
      metalness: s.metalness ?? 0,
      alphaTest: s.alphaTest,
      transparent: s.transparent,
      opacity: s.opacity,
      side: s.side,
      depthWrite: s.depthWrite,
      emissive: emissiveOn ? s.emissive : new THREE.Color(0),
      emissiveIntensity: 1,
    });
    result = { material, uvScale };
  }

  // JPEG keeps files small; leaf cut-outs need the alpha channel, so they stay PNG.
  const m = result.material;
  for (const tex of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap]) {
    if (!tex) continue;
    repeatOf(tex);
    tex.userData.mimeType = tex === m.map && m.alphaTest > 0 ? 'image/png' : 'image/jpeg';
  }
  converted.set(key, result);
  return result;
}

/** Called just before writing, after every UV has been scaled. */
function clearTextureTransforms() {
  for (const tex of repeats.keys()) {
    tex.repeat.set(1, 1);
    tex.offset.set(0, 0);
    tex.updateMatrix();
  }
}

/* ---------- Geometry baking ---------- */

interface Piece {
  geometry: THREE.BufferGeometry;
  matrices: THREE.Matrix4[];
}

function shouldSkip(mesh: THREE.Mesh): boolean {
  const m = mesh.material as THREE.Material;
  if (Array.isArray(mesh.material) || !m) return true;
  if (m.colorWrite === false) return true; // picking proxies, depth pre-pass, shadow casters
  if ((m as THREE.ShaderMaterial).isShaderMaterial) return true; // sky
  if (m.blending === THREE.AdditiveBlending) return true; // light pools, highlight tint
  if (m.transparent && m.opacity < 0.01) return true; // inactive highlights
  if (m.name === 'M_LeavesFar') return true; // distant canopy billboards
  let o: THREE.Object3D | null = mesh;
  while (o) {
    if (!o.visible) return true;
    o = o.parent;
  }
  return false;
}

function instanceMatrices(mesh: THREE.Mesh, base: THREE.Matrix4): THREE.Matrix4[] {
  const im = mesh as THREE.InstancedMesh;
  if (!im.isInstancedMesh) return [base.clone().multiply(mesh.matrixWorld)];
  const out: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const world = base.clone().multiply(mesh.matrixWorld);
  for (let i = 0; i < im.count; i++) {
    im.getMatrixAt(i, m);
    out.push(world.clone().multiply(m));
  }
  return out;
}

/** Merges everything in one category into one mesh with a material slot per material. */
function bakeCategory(name: string, byMaterial: Map<StdMat, { pieces: Piece[]; uvScale: THREE.Vector2 }>): THREE.Mesh {
  let vertexCount = 0;
  let indexCount = 0;
  for (const { pieces } of byMaterial.values()) {
    for (const p of pieces) {
      const pos = p.geometry.attributes.position;
      const idx = p.geometry.index ? p.geometry.index.count : pos.count;
      vertexCount += pos.count * p.matrices.length;
      indexCount += idx * p.matrices.length;
    }
  }
  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const index = new Uint32Array(indexCount);
  const geometry = new THREE.BufferGeometry();
  const materials: StdMat[] = [];
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  let vo = 0;
  let io = 0;

  for (const [material, { pieces, uvScale }] of byMaterial) {
    const start = io;
    for (const { geometry: g, matrices } of pieces) {
      const pos = g.attributes.position;
      const nor = g.attributes.normal;
      const tex = g.attributes.uv;
      for (const m of matrices) {
        nm.getNormalMatrix(m);
        const base = vo;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(m);
          position.set([v.x, v.y, v.z], vo * 3);
          if (nor) {
            n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
          } else {
            n.set(0, 1, 0);
          }
          normal.set([n.x, n.y, n.z], vo * 3);
          if (tex) {
            uv[vo * 2] = tex.getX(i) * uvScale.x;
            uv[vo * 2 + 1] = tex.getY(i) * uvScale.y;
          }
          vo++;
        }
        // A mirrored transform flips the triangle winding, so swap it back.
        const flip = m.determinant() < 0;
        const count = g.index ? g.index.count : pos.count;
        for (let i = 0; i < count; i += 3) {
          const a = g.index ? g.index.getX(i) : i;
          const b = g.index ? g.index.getX(i + 1) : i + 1;
          const c = g.index ? g.index.getX(i + 2) : i + 2;
          index[io++] = base + a;
          index[io++] = base + (flip ? c : b);
          index[io++] = base + (flip ? b : c);
        }
      }
    }
    geometry.addGroup(start, io - start, materials.length);
    materials.push(material);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.name = name;
  return mesh;
}

function collect(
  root: THREE.Object3D,
  base: THREE.Matrix4,
  categoryOf: (mesh: THREE.Mesh, instance: number) => string | null,
): THREE.Mesh[] {
  const cats = new Map<string, Map<StdMat, { pieces: Piece[]; uvScale: THREE.Vector2 }>>();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || shouldSkip(mesh)) return;
    const { material, uvScale } = convert(mesh.material as THREE.Material);
    instanceMatrices(mesh, base).forEach((matrix, i) => {
      const cat = categoryOf(mesh, i);
      if (!cat) return;
      let byMat = cats.get(cat);
      if (!byMat) {
        byMat = new Map();
        cats.set(cat, byMat);
      }
      let entry = byMat.get(material);
      if (!entry) {
        entry = { pieces: [], uvScale };
        byMat.set(material, entry);
      }
      const last = entry.pieces[entry.pieces.length - 1];
      if (last?.geometry === mesh.geometry) last.matrices.push(matrix);
      else entry.pieces.push({ geometry: mesh.geometry, matrices: [matrix] });
    });
  });
  return [...cats].map(([name, byMaterial]) => bakeCategory(name, byMaterial));
}

/* ---------- Writing ---------- */

async function writeGlb(root: THREE.Object3D, renderer: THREE.WebGLRenderer): Promise<ArrayBuffer> {
  clearTextureTransforms();
  const exporter = new GLTFExporter();
  exporter.setTextureUtils({
    decompress: async (texture: THREE.Texture, max?: number) => {
      const readable = decompress(texture, max, renderer) as THREE.Texture;
      readable.userData.mimeType = texture.userData.mimeType;
      return readable;
    },
  } as never);
  const result = await exporter.parseAsync(root, { binary: true, maxTextureSize: 1024 });
  return result as ArrayBuffer;
}

export type Saver = (name: string, data: string | ArrayBuffer) => Promise<void>;

/** Empty named nodes that mark where something is, for selecting and scripting in Unreal. */
function marker(name: string, x: number, y: number, z: number, extras: Record<string, unknown> = {}): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  o.userData = extras;
  return o;
}

/* ---------- Site ---------- */

const SITE_GROUPS: Record<string, string> = {
  Ground: 'Ground',
  Amenities: 'Amenities',
  Cars: 'Cars',
  Context: 'Context_City',
  Lamps: 'Lamps',
  Vegetation: 'Vegetation',
  People: 'People',
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sitePart(save: Saver) {
  const identity = new THREE.Matrix4();
  const meshes = collect(win.__scene, identity, (mesh) => {
    let o: THREE.Object3D | null = mesh;
    while (o) {
      if (SITE_GROUPS[o.name]) return SITE_GROUPS[o.name];
      o = o.parent;
    }
    return null;
  });

  // The garage is built in idle time or on its first visit, and only shows in its own view.
  useAppStore.setState({ route: { view: 'garage' } });
  let garage: THREE.Object3D | undefined;
  for (let i = 0; i < 40 && !garage; i++) {
    await wait(500);
    garage = win.__scene.getObjectByName('Garage');
  }
  if (!garage) throw new Error('Garage did not load');
  await wait(1500);
  meshes.push(
    ...collect(garage, identity, (mesh) => {
      // Bay numbers and status colours are web overlays.
      const m = mesh.material as THREE.MeshBasicMaterial;
      return m.map && m.transparent ? null : 'Garage';
    }),
  );

  const root = new THREE.Group();
  root.name = 'Site';
  meshes.forEach((m) => root.add(m));
  for (const a of site.amenities) root.add(marker(`Amenity_${a.id}`, a.position[0], 0, a.position[1], { kind: a.kind }));
  await save('site.glb', await writeGlb(root, win.__renderer));
}

/* ---------- Blocks: one mesh per storey ---------- */

const LIT_OFFSET = 0.08;

/** Glowing quads over the windows the web shader lights at night, one mesh per storey to switch on after dark. */
function litWindows(group: THREE.Object3D, id: string, storeys: number): THREE.Mesh[] {
  let windows: THREE.InstancedMesh | undefined;
  group.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (m.isInstancedMesh && (m.material as THREE.Material).name === 'M_Glass') windows = m;
  });
  if (!windows) return [];
  const material = new THREE.MeshStandardMaterial({ name: 'M_WindowLit', color: '#000000', emissive: new THREE.Color(0.04, 0.03, 0.019) });
  const seeds = windows.geometry.getAttribute('aSeed');
  const perStorey = windows.count / storeys;
  const out: THREE.Mesh[] = [];
  const m = new THREE.Matrix4();
  const push = new THREE.Matrix4().makeTranslation(0, 0, LIT_OFFSET);
  const base = group.matrixWorld;
  for (let s = 0; s < storeys; s++) {
    const matrices: THREE.Matrix4[] = [];
    for (let i = s * perStorey; i < (s + 1) * perStorey; i++) {
      const seed = seeds.getX(i) * 91.7;
      // Same test as the window shader, so the same rooms are lit.
      if (seed - Math.floor(seed) < 0.56) continue;
      windows.getMatrixAt(i, m);
      matrices.push(base.clone().multiply(m).multiply(push));
    }
    if (matrices.length) {
      const pieces = new Map([[material, { pieces: [{ geometry: windows.geometry, matrices }], uvScale: new THREE.Vector2(1, 1) }]]);
      out.push(bakeCategory(`Floor_${id}_${s + 2}_Lit`, pieces));
    }
  }
  return out;
}

export async function blockPart(id: string, save: Saver) {
  // Towers are hidden in the garage view, where sitePart leaves the scene, and collect() skips hidden
  // objects. Back to the overview first, and give the scene a couple of frames to show them again.
  useAppStore.setState({ route: { view: 'overview' } });
  await wait(300);
  const def = blockById(id);
  const group = win.__scene.getObjectByName(`Block_${id}`);
  if (!def || !group) throw new Error(`No block ${id}`);
  const storeys = def.storeys - 1;
  const meshes = collect(group, new THREE.Matrix4(), (mesh, instance) => {
    const im = mesh as THREE.InstancedMesh;
    if (im.isInstancedMesh) return `Floor_${id}_${Math.floor(instance / (im.count / storeys)) + 2}`;
    return mesh.parent === group ? `Block_${id}_Roof` : `Block_${id}_VoidDeck`;
  });
  const root = new THREE.Group();
  root.name = `Block_${id}`;
  meshes.forEach((m) => root.add(m));
  litWindows(group, id, storeys).forEach((m) => root.add(m));
  for (let storey = 2; storey <= def.storeys; storey++) {
    for (const st of def.stacks) {
      const xf = unitXform(def, st);
      root.add(
        marker(`Unit_${id}_${storey}_${st.stack}`, def.position[0] + xf.center[0], storeyY(storey), def.position[1] + xf.center[1], {
          number: unitNumber(storey, st.stack),
          type: st.type,
        }),
      );
    }
  }
  await save(`block_${id}.glb`, await writeGlb(root, win.__renderer));
}

/* ---------- Flats ---------- */

/** Exports a flat in its own coordinates: the plan's corner at floor level, windows along z = 0. */
export async function interiorPart(type: string, cut: boolean, scene: THREE.Scene, gl: THREE.WebGLRenderer, save: Saver) {
  const interior = scene.getObjectByName('interior');
  if (!interior) throw new Error('Interior not mounted');
  const meshes = collect(interior, new THREE.Matrix4(), (mesh) => {
    const name = (mesh.material as THREE.Material).name;
    if (name === 'M_Ceiling') return `Room_${type}_Ceiling`;
    if (name === 'M_LightOn') return `Room_${type}_LightFittings`;
    let o: THREE.Object3D | null = mesh;
    while (o && o !== interior) {
      if (o.parent?.name === 'furniture') return `Room_${type}_${o.name}`;
      if (o.name === 'decor') return `Room_${type}_Decor`;
      o = o.parent;
    }
    return `Room_${type}_Shell`;
  });
  const root = new THREE.Group();
  root.name = cut ? `Topview_${type}` : `Interior_${type}`;
  meshes.forEach((m) => root.add(m));
  for (const r of interiors[type].rooms) {
    const q = r.rects[0];
    root.add(marker(`Room_${type}_${r.room}`, (q[0] + q[2]) / 2, 0, (q[1] + q[3]) / 2));
  }
  await save(`${cut ? 'topview' : 'interior'}_${type}.glb`, await writeGlb(root, gl));
}

/* ---------- Data ---------- */

const pretty = (v: unknown) => JSON.stringify(v, null, 2);

export async function dataFiles(save: Saver) {
  const views = Object.fromEntries(
    blocks.map((b) => {
      const { pos, target, fov } = shotFor({ view: 'block', block: b.id });
      return [b.id, { pos, target, fov }];
    }),
  );
  await save('hotspots.json', pretty(hotspotsJson()));
  await save('cameras.json', pretty(camerasJson(views)));
  await save('sun.json', pretty(sunJson()));
  await save('interiors.json', pretty(interiorsJson()));
  await save('topview_props.json', pretty(topviewPropsJson()));
  await save('units.csv', unitsCsv());
}

const types = Object.keys(interiors);

export const EXPORT_PARTS: string[] = [
  'data',
  'site',
  ...blocks.map((b) => `block_${b.id}`),
  ...types.map((t) => `interior_${t}`),
  ...types.map((t) => `topview_${t}`),
];
