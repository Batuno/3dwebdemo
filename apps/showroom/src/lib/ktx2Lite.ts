// Half-resolution KTX2 textures for phones, made by dropping the top mip level of the existing files.
// Every level is stored (and supercompressed) on its own, so this is a byte copy: no re-encoding, the
// same look one mip down, and roughly a quarter of the size. Used by the ktx2Lite plugin in vite.config.ts.

const IDENTIFIER = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];
const HEADER = 80;
const LEVEL_ENTRY = 24;
const BASIS_LZ = 1;
const ZSTD = 2;
/** BasisLZ global data: a 20-byte header, then one 20-byte descriptor per image. */
const SGD_HEADER = 20;
const IMAGE_DESC = 20;

/** Below this width a texture is left as it is. */
export const LITE_MIN_WIDTH = 512;

const align = (n: number, to: number) => Math.ceil(n / to) * to;

/**
 * The same texture without its largest mip level, or null when the file isn't a supercompressed 2D KTX2
 * (BasisLZ or Zstandard) with more than one level and at least LITE_MIN_WIDTH wide.
 */
export function dropTopMip(src: Uint8Array): Uint8Array | null {
  if (src.byteLength < HEADER || IDENTIFIER.some((b, i) => src[i] !== b)) return null;
  const dv = new DataView(src.buffer, src.byteOffset, src.byteLength);
  const u32 = (o: number) => dv.getUint32(o, true);
  const u64 = (o: number) => Number(dv.getBigUint64(o, true));
  const width = u32(20);
  const height = u32(24);
  const depth = u32(28);
  const layers = u32(32);
  const faces = u32(36);
  const levels = u32(40);
  const scheme = u32(44);
  if (levels < 2 || depth > 1 || width < LITE_MIN_WIDTH || (scheme !== BASIS_LZ && scheme !== ZSTD)) return null;

  const dfdOff = u32(48);
  const dfdLen = u32(52);
  const kvdOff = u32(56);
  const kvdLen = u32(60);
  const sgdOff = u64(64);
  const sgdLen = u64(72);
  const index = Array.from({ length: levels }, (_, i) => ({
    off: u64(HEADER + i * LEVEL_ENTRY),
    len: u64(HEADER + i * LEVEL_ENTRY + 8),
    raw: u64(HEADER + i * LEVEL_ENTRY + 16),
  }));
  if (index.some((l) => l.off + l.len > src.byteLength)) return null;

  // BasisLZ keeps one image descriptor per level (times layers and faces), level 0 first.
  const perLevel = Math.max(1, layers) * Math.max(1, faces);
  let sgd = new Uint8Array(0);
  if (sgdLen > 0) {
    if (scheme !== BASIS_LZ || sgdLen < SGD_HEADER + IMAGE_DESC * perLevel * levels) return null;
    const old = src.subarray(sgdOff, sgdOff + sgdLen);
    const cut = IMAGE_DESC * perLevel;
    sgd = new Uint8Array(sgdLen - cut);
    sgd.set(old.subarray(0, SGD_HEADER), 0);
    sgd.set(old.subarray(SGD_HEADER + cut), SGD_HEADER);
  }

  const kept = index.slice(1);
  const newDfdOff = HEADER + LEVEL_ENTRY * kept.length;
  const newKvdOff = kvdLen ? newDfdOff + dfdLen : 0;
  const afterKvd = newDfdOff + dfdLen + kvdLen;
  const newSgdOff = sgd.byteLength ? align(afterKvd, 8) : 0;
  const dataStart = sgd.byteLength ? newSgdOff + sgd.byteLength : afterKvd;
  // Supercompressed levels need no alignment; keep them in the file's own order (smallest first).
  const order = [...kept].sort((a, b) => a.off - b.off);
  const placed = new Map<(typeof kept)[number], number>();
  let cursor = dataStart;
  for (const l of order) {
    placed.set(l, cursor);
    cursor += l.len;
  }

  const out = new Uint8Array(cursor);
  const w = new DataView(out.buffer);
  out.set(src.subarray(0, HEADER), 0);
  w.setUint32(20, Math.max(1, width >> 1), true);
  w.setUint32(24, height ? Math.max(1, height >> 1) : 0, true);
  w.setUint32(40, kept.length, true);
  w.setUint32(48, newDfdOff, true);
  w.setUint32(52, dfdLen, true);
  w.setUint32(56, newKvdOff, true);
  w.setUint32(60, kvdLen, true);
  w.setBigUint64(64, BigInt(newSgdOff), true);
  w.setBigUint64(72, BigInt(sgd.byteLength), true);
  kept.forEach((l, i) => {
    const o = HEADER + i * LEVEL_ENTRY;
    w.setBigUint64(o, BigInt(placed.get(l)!), true);
    w.setBigUint64(o + 8, BigInt(l.len), true);
    w.setBigUint64(o + 16, BigInt(l.raw), true);
  });
  out.set(src.subarray(dfdOff, dfdOff + dfdLen), newDfdOff);
  if (kvdLen) out.set(src.subarray(kvdOff, kvdOff + kvdLen), newKvdOff);
  if (sgd.byteLength) out.set(sgd, newSgdOff);
  for (const l of kept) out.set(src.subarray(l.off, l.off + l.len), placed.get(l)!);
  return out;
}
