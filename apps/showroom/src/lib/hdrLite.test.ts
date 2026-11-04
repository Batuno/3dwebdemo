import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { halveHdr, readHdr, writeHdr } from './hdrLite';

const mean = (rgb: Float32Array) => rgb.reduce((a, b) => a + b, 0) / rgb.length;

describe('hdrLite', () => {
  it('round-trips flat RGBE within its precision', () => {
    const w = 8;
    const h = 4;
    const rgb = new Float32Array(w * h * 3).map((_, i) => (i % 7) * 0.37 + (i % 3) * 120);
    const back = readHdr(writeHdr(w, h, rgb))!;
    expect(back.width).toBe(w);
    expect(back.height).toBe(h);
    rgb.forEach((v, i) => expect(Math.abs(back.rgb[i] - v)).toBeLessThanOrEqual(Math.max(...[rgb[i - (i % 3)], rgb[i - (i % 3) + 1], rgb[i - (i % 3) + 2]]) / 128 + 1e-6));
  });

  it('reads run-length encoded scanlines', () => {
    const w = 8;
    // One scanline, each channel a single run of 8: R=128, G=64, B=32, E=129 (so R = 128/256 * 2 = 1).
    const head = new TextEncoder().encode('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 8\n');
    const body = [2, 2, 0, w, 128 + 8, 128, 128 + 8, 64, 128 + 8, 32, 128 + 8, 129];
    const file = new Uint8Array([...head, ...body]);
    const img = readHdr(file)!;
    expect([img.rgb[0], img.rgb[1], img.rgb[2]]).toEqual([1, 0.5, 0.25]);
    expect(img.rgb[21]).toBe(1);
  });

  it('halves an image and keeps its energy', () => {
    const w = 16;
    const h = 8;
    const rgb = new Float32Array(w * h * 3).map((_, i) => 1 + (i % 11));
    const half = readHdr(halveHdr(writeHdr(w, h, rgb))!)!;
    expect(half.width).toBe(8);
    expect(half.height).toBe(4);
    expect(Math.abs(mean(half.rgb) - mean(rgb)) / mean(rgb)).toBeLessThan(0.02);
  });

  const dir = path.resolve(import.meta.dirname, '../../public/assets/hdri');
  const pulled = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.hdr') && fs.statSync(path.join(dir, f)).size > 1024) : [];
  it.skipIf(pulled.length === 0)('halves the real image lights without changing their brightness', () => {
    for (const f of pulled) {
      const src = new Uint8Array(fs.readFileSync(path.join(dir, f)));
      const full = readHdr(src)!;
      const half = readHdr(halveHdr(src)!)!;
      expect(half.width).toBe(full.width / 2);
      expect(Math.abs(mean(half.rgb) - mean(full.rgb)) / mean(full.rgb)).toBeLessThan(0.02);
    }
  });
});
