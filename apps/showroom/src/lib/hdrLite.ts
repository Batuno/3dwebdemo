// Half-size Radiance (.hdr) image light for phones: the equirectangular map averaged 2×2 and written back
// as flat RGBE. The light it gives is the same (it is blurred into irradiance anyway); only reflections
// soften a little. Used by the asset plugin in vite.config.ts.

/** Decodes an RGBE file (flat or new-style run-length) into linear RGB floats. */
export function readHdr(src: Uint8Array): { width: number; height: number; rgb: Float32Array } | null {
  let p = 0;
  const line = () => {
    let s = '';
    while (p < src.length && src[p] !== 0x0a) s += String.fromCharCode(src[p++]);
    p++;
    return s;
  };
  if (!line().startsWith('#?')) return null;
  while (p < src.length && line() !== '');
  const size = line().match(/^-Y (\d+) \+X (\d+)$/);
  if (!size) return null;
  const height = Number(size[1]);
  const width = Number(size[2]);
  const rgbe = new Uint8Array(width * height * 4);
  const scan = new Uint8Array(width * 4);
  for (let y = 0; y < height; y++) {
    const rle = width >= 8 && width < 0x8000 && src[p] === 2 && src[p + 1] === 2 && !(src[p + 2] & 0x80);
    if (!rle) {
      if (p + width * 4 > src.length) return null;
      rgbe.set(src.subarray(p, p + width * 4), y * width * 4);
      p += width * 4;
      continue;
    }
    if (((src[p + 2] << 8) | src[p + 3]) !== width) return null;
    p += 4;
    // Each of the four channels is run-length encoded on its own.
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < width) {
        if (p >= src.length) return null;
        let n = src[p++];
        if (n > 128) {
          n -= 128;
          const v = src[p++];
          for (let i = 0; i < n; i++) scan[(x++) * 4 + c] = v;
        } else {
          for (let i = 0; i < n; i++) scan[(x++) * 4 + c] = src[p++];
        }
      }
    }
    rgbe.set(scan, y * width * 4);
  }
  const rgb = new Float32Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const e = rgbe[i * 4 + 3];
    const f = e ? 2 ** (e - 136) : 0; // (mantissa / 256) * 2^(e - 128)
    rgb[i * 3] = rgbe[i * 4] * f;
    rgb[i * 3 + 1] = rgbe[i * 4 + 1] * f;
    rgb[i * 3 + 2] = rgbe[i * 4 + 2] * f;
  }
  return { width, height, rgb };
}

/** Writes linear RGB floats as a flat (not run-length encoded) RGBE file. */
export function writeHdr(width: number, height: number, rgb: Float32Array): Uint8Array {
  const head = new TextEncoder().encode(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`);
  const out = new Uint8Array(head.length + width * height * 4);
  out.set(head, 0);
  for (let i = 0; i < width * height; i++) {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    const v = Math.max(r, g, b);
    const o = head.length + i * 4;
    if (v < 1e-32) continue;
    let e = Math.floor(Math.log2(v)) + 1;
    if (v / 2 ** e >= 1) e++;
    const scale = 256 / 2 ** e;
    out[o] = Math.min(255, r * scale);
    out[o + 1] = Math.min(255, g * scale);
    out[o + 2] = Math.min(255, b * scale);
    out[o + 3] = e + 128;
  }
  return out;
}

/** The image at half width and height, or null when it can't be read. */
export function halveHdr(src: Uint8Array): Uint8Array | null {
  const img = readHdr(src);
  if (!img || img.width < 4 || img.height < 2) return null;
  const w = img.width >> 1;
  const h = img.height >> 1;
  const rgb = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        const at = (yy: number, xx: number) => img.rgb[(yy * img.width + xx) * 3 + c];
        rgb[(y * w + x) * 3 + c] = (at(2 * y, 2 * x) + at(2 * y, 2 * x + 1) + at(2 * y + 1, 2 * x) + at(2 * y + 1, 2 * x + 1)) / 4;
      }
    }
  }
  return writeHdr(w, h, rgb);
}
