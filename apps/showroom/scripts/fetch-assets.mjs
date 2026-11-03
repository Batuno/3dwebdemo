// Downloads the CC0 source assets (Poly Haven, ambientCG) and compresses them into public/assets.
// Usage: node scripts/fetch-assets.mjs [hdri] [textures] [models]   (no args = everything)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { unzipSync } from 'fflate';
import { encodeToKTX2 } from 'ktx2-encoder';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import {
  dedup,
  prune,
  weld,
  simplify,
  reorder,
  quantize,
} from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, '.asset-cache');
const OUT = path.join(ROOT, 'public', 'assets');
const only = new Set(process.argv.slice(2));
const want = (k) => only.size === 0 || only.has(k);

const HDRIS = {
  day: { id: 'kloofendal_48d_partly_cloudy_puresky', skyWidth: 4096 },
  night: { id: 'kloppenheim_02_puresky', skyWidth: 2048 },
};

// slot -> ambientCG asset id, output size and which maps to keep
const TEXTURES = {
  grass: { id: 'Grass004', size: 1024, maps: ['Color', 'NormalGL', 'Roughness'] },
  asphalt: { id: 'Asphalt031', size: 1024, maps: ['Color', 'NormalGL', 'Roughness'] },
  paving: { id: 'PavingStones138', size: 1024, maps: ['Color', 'NormalGL', 'Roughness'] },
  concrete: { id: 'Concrete034', size: 1024, maps: ['Color', 'NormalGL', 'Roughness'] },
  plaster: { id: 'Plaster001', size: 1024, maps: ['Color', 'NormalGL', 'Roughness'] },
  woodfloor: { id: 'WoodFloor051', size: 1024, maps: ['Color', 'NormalGL', 'Roughness'] },
  tile: { id: 'Marble012', size: 1024, maps: ['Color', 'NormalGL', 'Roughness'] },
  fabric: { id: 'Fabric061', size: 512, maps: ['Color', 'NormalGL', 'Roughness'] },
  carpet: { id: 'Carpet016', size: 512, maps: ['Color', 'NormalGL', 'Roughness'] },
  rubber: { id: 'Rubber004', size: 512, maps: ['Color', 'NormalGL', 'Roughness'] },
  bark: { id: 'Bark014', size: 512, maps: ['Color', 'NormalGL', 'Roughness'] },
  wood: { id: 'Wood092', size: 512, maps: ['Color', 'NormalGL', 'Roughness'] },
};

// Poly Haven glTF models; maxTris triggers mesh simplification
const MODELS = {
  sofa_02: { maxTris: 8000 },
  modern_arm_chair_01: { maxTris: 8000 },
  modern_coffee_table_01: { maxTris: 6000 },
  coffee_table_round_01: { maxTris: 6000 },
  gallinera_table: { maxTris: 6000 },
  dining_chair_02: { maxTris: 6000 },
  modern_wooden_cabinet: { maxTris: 10000 },
  side_table_01: { maxTris: 4000 },
  potted_plant_04: { maxTris: 6000 },
  pachira_aquatica_01: { maxTris: 16000 },
  modern_ceiling_lamp_01: { maxTris: 6000 },
  hanging_industrial_lamp: { maxTris: 6000 },
  throw_pillows_01: { maxTris: 6000 },
  wooden_display_shelves_01: { maxTris: 4000 },
  standing_picture_frame_01: { maxTris: 2000 },
  hanging_picture_frame_01: { maxTris: 2600 },
  ceramic_vase_01: { maxTris: 2600 },
  street_lamp_01: { maxTris: 3000 },
};

const ensure = (d) => fs.mkdirSync(d, { recursive: true });

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
  ensure(path.dirname(dest));
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('  downloaded', path.basename(dest));
  return dest;
}

const decodeRgba = async (buffer) => {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};

const toKtx2 = (png, uastc) =>
  encodeToKTX2(new Uint8Array(png), {
    isUASTC: uastc,
    enableRDO: uastc,
    rdoQualityLevel: 2,
    needSupercompression: true,
    qualityLevel: 160,
    compressionLevel: 2,
    generateMipmap: true,
    imageDecoder: decodeRgba,
    isNormalMap: false,
    isSetKV: false,
  });

/* ---------- HDRI ---------- */

function parseHdr(buf) {
  let p = 0;
  const line = () => {
    let s = '';
    while (buf[p] !== 10) s += String.fromCharCode(buf[p++]);
    p++;
    return s;
  };
  while (line() !== '');
  const m = line().match(/-Y (\d+) \+X (\d+)/);
  const H = +m[1];
  const W = +m[2];
  const out = new Float32Array(W * H * 3);
  const scan = new Uint8Array(W * 4);
  for (let y = 0; y < H; y++) {
    p += 4; // RLE scanline header
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < W) {
        let n = buf[p++];
        if (n > 128) {
          n -= 128;
          const v = buf[p++];
          for (let i = 0; i < n; i++) scan[x++ * 4 + c] = v;
        } else {
          for (let i = 0; i < n; i++) scan[x++ * 4 + c] = buf[p++];
        }
      }
    }
    for (let x = 0; x < W; x++) {
      const e = scan[x * 4 + 3];
      const f = e ? 2 ** (e - 136) : 0;
      const o = (y * W + x) * 3;
      out[o] = scan[x * 4] * f;
      out[o + 1] = scan[x * 4 + 1] * f;
      out[o + 2] = scan[x * 4 + 2] * f;
    }
  }
  return { W, H, data: out };
}

async function hdri() {
  const dir = path.join(OUT, 'hdri');
  ensure(dir);
  const meta = {};
  for (const [name, { id, skyWidth }] of Object.entries(HDRIS)) {
    console.log('hdri', name, id);
    const base = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr`;
    const big = await download(`${base}/4k/${id}_4k.hdr`, path.join(CACHE, `${id}_4k.hdr`));
    const small = await download(`${base}/1k/${id}_1k.hdr`, path.join(CACHE, `${id}_1k.hdr`));
    fs.copyFileSync(small, path.join(dir, `${name}.hdr`));
    const { W, H, data } = parseHdr(fs.readFileSync(big));

    // Sun: centroid of the brightest pixels
    let peak = 0;
    for (let i = 0; i < W * H; i++) {
      const l = data[i * 3] * 0.2126 + data[i * 3 + 1] * 0.7152 + data[i * 3 + 2] * 0.0722;
      if (l > peak) peak = l;
    }
    let sx = 0;
    let sy = 0;
    let sc = 0;
    let sumCos = 0;
    let sumSin = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const l = data[i * 3] * 0.2126 + data[i * 3 + 1] * 0.7152 + data[i * 3 + 2] * 0.0722;
        if (l > peak * 0.5) {
          const a = (x / W) * Math.PI * 2;
          sumCos += Math.cos(a);
          sumSin += Math.sin(a);
          sy += y;
          sc++;
        }
      }
    }
    sx = ((Math.atan2(sumSin, sumCos) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
    meta[name] = {
      source: id,
      sunU: +sx.toFixed(4),
      sunV: +(sy / sc / H).toFixed(4),
      elevationDeg: +((0.5 - sy / sc / H) * 180).toFixed(1),
      peak: +peak.toFixed(1),
    };

    // Sharp LDR sky for the background. Reversible Reinhard: v = c/(1+c), gamma 2.2.
    const scale = W / skyWidth;
    const sw = skyWidth;
    const sh = skyWidth / 2;
    const rgb = Buffer.alloc(sw * sh * 3);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const sxp = Math.min(W - 1, Math.floor(x * scale));
        const syp = Math.min(H - 1, Math.floor(y * scale));
        const i = (syp * W + sxp) * 3;
        for (let c = 0; c < 3; c++) {
          const v = data[i + c];
          rgb[(y * sw + x) * 3 + c] = Math.round(Math.pow(v / (1 + v), 1 / 2.2) * 255);
        }
      }
    }
    await sharp(rgb, { raw: { width: sw, height: sh, channels: 3 } })
      .webp({ quality: 88, smartSubsample: true })
      .toFile(path.join(dir, `sky_${name}.webp`));
    console.log('  sun', meta[name]);
  }
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
}

/* ---------- PBR textures ---------- */

async function textures() {
  const dir = path.join(OUT, 'textures');
  ensure(dir);
  for (const [slot, { id, size, maps }] of Object.entries(TEXTURES)) {
    console.log('texture', slot, id);
    const zipPath = await download(
      `https://ambientcg.com/get?file=${id}_1K-JPG.zip`,
      path.join(CACHE, `${id}_1K-JPG.zip`),
    );
    const files = unzipSync(fs.readFileSync(zipPath));
    for (const map of maps) {
      const key = Object.keys(files).find((k) => k.endsWith(`_${map}.jpg`));
      if (!key) {
        console.warn('  missing map', map, Object.keys(files));
        continue;
      }
      const png = await sharp(Buffer.from(files[key]))
        .resize(size, size, { fit: 'fill' })
        .png()
        .toBuffer();
      const uastc = map === 'NormalGL';
      const ktx = await toKtx2(png, uastc);
      const short = { Color: 'color', NormalGL: 'normal', Roughness: 'rough', Opacity: 'opacity' }[map];
      fs.writeFileSync(path.join(dir, `${slot}_${short}.ktx2`), ktx);
    }
  }
}

/* ---------- Procedural leaf atlas (generated here, no third-party source) ---------- */

async function leaves() {
  const dir = path.join(OUT, 'textures');
  ensure(dir);
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const CELL = 512;
  const parts = [];
  for (let cy = 0; cy < 2; cy++) {
    for (let cx = 0; cx < 2; cx++) {
      const ox = cx * CELL + CELL / 2;
      const oy = cy * CELL + CELL / 2;
      const count = 230;
      for (let i = 0; i < count; i++) {
        const t = i / count; // dark, shaded leaves first; bright ones end up on top
        const a = rnd() * Math.PI * 2;
        const r = Math.sqrt(rnd()) * CELL * 0.43 * (1 - t * 0.25);
        const x = ox + Math.cos(a) * r;
        const y = oy + Math.sin(a) * r;
        const len = 26 + rnd() * 26;
        const wid = len * (0.36 + rnd() * 0.16);
        const rot = rnd() * 360;
        const h = 88 + rnd() * 34;
        const s = 32 + rnd() * 26;
        const l = 12 + t * 26 + rnd() * 9;
        parts.push(
          `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)})">` +
            `<path d="M0 0 C ${(len * 0.3).toFixed(1)} ${(-wid).toFixed(1)}, ${(len * 0.75).toFixed(1)} ${(-wid * 0.8).toFixed(1)}, ${len.toFixed(1)} 0 C ${(len * 0.75).toFixed(1)} ${(wid * 0.8).toFixed(1)}, ${(len * 0.3).toFixed(1)} ${wid.toFixed(1)}, 0 0Z" fill="hsl(${h.toFixed(0)},${s.toFixed(0)}%,${l.toFixed(0)}%)"/>` +
            `<path d="M0 0 L ${len.toFixed(1)} 0" stroke="hsl(${h.toFixed(0)},${s.toFixed(0)}%,${(l + 12).toFixed(0)}%)" stroke-width="1.2"/></g>`,
        );
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">${parts.join('')}</svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Bleed a leaf green under transparent pixels so mips don't fringe to black.
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      data[i] = 44;
      data[i + 1] = 66;
      data[i + 2] = 28;
    }
  }
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  fs.writeFileSync(path.join(CACHE, 'leaves.png'), png);
  fs.writeFileSync(path.join(dir, 'leaves_color.ktx2'), await toKtx2(png, false));
}

/* ---------- glTF models ---------- */

const pendingTextures = async (document) => {
  // Resize to 512 and encode: normals UASTC, everything else ETC1S.
  const root = document.getRoot();
  const normalTex = new Set(
    root.listMaterials().map((m) => m.getNormalTexture()).filter(Boolean),
  );
  document.createExtension(ALL_EXTENSIONS.find((e) => e.EXTENSION_NAME === 'KHR_texture_basisu')).setRequired(true);
  for (const tex of root.listTextures()) {
    const img = tex.getImage();
    if (!img) continue;
    const png = await sharp(Buffer.from(img))
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    // basis needs multiple-of-4 friendly sizes; pad via exact resize
    const m = await sharp(png).metadata();
    const w = Math.max(4, Math.round(m.width / 4) * 4);
    const h = Math.max(4, Math.round(m.height / 4) * 4);
    const fitted = await sharp(png).resize(w, h, { fit: 'fill' }).png().toBuffer();
    const ktx = await toKtx2(fitted, normalTex.has(tex));
    tex.setImage(new Uint8Array(ktx)).setMimeType('image/ktx2');
    tex.setURI(tex.getName() ? `${tex.getName()}.ktx2` : '');
  }
};

async function models() {
  const dir = path.join(OUT, 'models');
  ensure(dir);
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
  });
  for (const [id, { maxTris }] of Object.entries(MODELS)) {
    console.log('model', id);
    const info = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
    const g = info.gltf['1k'].gltf;
    const modelDir = path.join(CACHE, 'models', id);
    const mainPath = await download(g.url, path.join(modelDir, `${id}_1k.gltf`));
    for (const [rel, f] of Object.entries(g.include)) {
      await download(f.url, path.join(modelDir, rel));
    }
    const doc = await io.read(mainPath);
    const tris = doc
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives())
      .reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);
    await doc.transform(weld(), dedup());
    if (tris > maxTris) {
      await doc.transform(
        simplify({ simplifier: MeshoptSimplifier, ratio: maxTris / tris, error: 0.01, lockBorder: false }),
      );
    }
    await doc.transform(prune({ keepAttributes: true }), reorder({ encoder: MeshoptEncoder }), quantize());
    await pendingTextures(doc);
    doc
      .createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
    const glb = await io.writeBinary(doc);
    fs.writeFileSync(path.join(dir, `${id}.glb`), glb);
    const after = doc
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives())
      .reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);
    console.log(`  ${Math.round(tris)} -> ${Math.round(after)} tris, ${(glb.length / 1024).toFixed(0)} KB`);
  }
}

if (want('hdri')) await hdri();
if (want('textures')) await textures();
if (want('leaves')) await leaves();
if (want('models')) await models();
console.log('done');
