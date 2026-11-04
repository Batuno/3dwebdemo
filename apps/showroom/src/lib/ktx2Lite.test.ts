import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dropTopMip } from './ktx2Lite';

const IDENTIFIER = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];

/** A minimal KTX2 file: header, level index, DFD, KVD, optional BasisLZ global data, then level data. */
function makeKtx2(scheme: 1 | 2, width: number, levels: number) {
  const dfd = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const kvd = new Uint8Array([9, 9, 9, 9]);
  // Level i holds bytes all equal to 100 + i, and is 4^(levels - i) bytes long (smallest last in the index).
  const data = Array.from({ length: levels }, (_, i) => new Uint8Array(4 ** (levels - i)).fill(100 + i));
  let sgd = new Uint8Array(0);
  if (scheme === 1) {
    sgd = new Uint8Array(20 + 20 * levels + 6);
    sgd.fill(0xee, 0, 20);
    for (let i = 0; i < levels; i++) sgd.fill(i + 1, 20 + 20 * i, 40 + 20 * i);
    sgd.fill(0xcc, 20 + 20 * levels);
  }
  const header = 80 + 24 * levels;
  const dfdOff = header;
  const kvdOff = dfdOff + dfd.length;
  const sgdOff = sgd.length ? Math.ceil((kvdOff + kvd.length) / 8) * 8 : 0;
  let cursor = sgd.length ? sgdOff + sgd.length : kvdOff + kvd.length;
  // Stored smallest level first, as encoders write them.
  const offsets: number[] = [];
  for (let i = levels - 1; i >= 0; i--) {
    offsets[i] = cursor;
    cursor += data[i].length;
  }
  const out = new Uint8Array(cursor);
  const dv = new DataView(out.buffer);
  out.set(IDENTIFIER, 0);
  dv.setUint32(20, width, true);
  dv.setUint32(24, width, true);
  dv.setUint32(36, 1, true);
  dv.setUint32(40, levels, true);
  dv.setUint32(44, scheme, true);
  dv.setUint32(48, dfdOff, true);
  dv.setUint32(52, dfd.length, true);
  dv.setUint32(56, kvdOff, true);
  dv.setUint32(60, kvd.length, true);
  dv.setBigUint64(64, BigInt(sgdOff), true);
  dv.setBigUint64(72, BigInt(sgd.length), true);
  for (let i = 0; i < levels; i++) {
    dv.setBigUint64(80 + 24 * i, BigInt(offsets[i]), true);
    dv.setBigUint64(88 + 24 * i, BigInt(data[i].length), true);
    dv.setBigUint64(96 + 24 * i, BigInt(scheme === 2 ? data[i].length * 3 : 0), true);
  }
  out.set(dfd, dfdOff);
  out.set(kvd, kvdOff);
  if (sgd.length) out.set(sgd, sgdOff);
  data.forEach((d, i) => out.set(d, offsets[i]));
  return out;
}

function read(file: Uint8Array) {
  const dv = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const levels = dv.getUint32(40, true);
  return {
    width: dv.getUint32(20, true),
    height: dv.getUint32(24, true),
    levels,
    dfd: file.subarray(dv.getUint32(48, true), dv.getUint32(48, true) + dv.getUint32(52, true)),
    kvd: file.subarray(dv.getUint32(56, true), dv.getUint32(56, true) + dv.getUint32(60, true)),
    sgdOff: Number(dv.getBigUint64(64, true)),
    sgd: file.subarray(Number(dv.getBigUint64(64, true)), Number(dv.getBigUint64(64, true)) + Number(dv.getBigUint64(72, true))),
    level: (i: number) => {
      const off = Number(dv.getBigUint64(80 + 24 * i, true));
      const len = Number(dv.getBigUint64(88 + 24 * i, true));
      return { bytes: file.subarray(off, off + len), raw: Number(dv.getBigUint64(96 + 24 * i, true)) };
    },
  };
}

describe('dropTopMip', () => {
  it('drops level 0 of a Zstandard (UASTC) texture', () => {
    const src = makeKtx2(2, 1024, 4);
    const out = read(dropTopMip(src)!);
    expect(out.width).toBe(512);
    expect(out.height).toBe(512);
    expect(out.levels).toBe(3);
    expect([...out.dfd]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out.kvd]).toEqual([9, 9, 9, 9]);
    for (let i = 0; i < 3; i++) {
      const l = out.level(i);
      expect(l.bytes.length).toBe(4 ** (3 - i));
      expect(l.bytes.every((b) => b === 101 + i)).toBe(true);
      expect(l.raw).toBe(l.bytes.length * 3);
    }
  });

  it('drops level 0 and its image descriptor from a BasisLZ (ETC1S) texture', () => {
    const src = makeKtx2(1, 512, 3);
    const out = read(dropTopMip(src)!);
    expect(out.width).toBe(256);
    expect(out.levels).toBe(2);
    expect(out.sgdOff % 8).toBe(0);
    // Header kept, descriptor for level 0 (filled with 1) gone, the rest and the trailing tables kept.
    expect(out.sgd.length).toBe(20 + 20 * 2 + 6);
    expect(out.sgd.subarray(0, 20).every((b) => b === 0xee)).toBe(true);
    expect(out.sgd.subarray(20, 40).every((b) => b === 2)).toBe(true);
    expect(out.sgd.subarray(40, 60).every((b) => b === 3)).toBe(true);
    expect(out.sgd.subarray(60).every((b) => b === 0xcc)).toBe(true);
    expect(out.level(0).bytes.every((b) => b === 101)).toBe(true);
    expect(out.level(1).bytes.every((b) => b === 102)).toBe(true);
  });

  it('leaves small, single-level and non-KTX2 files alone', () => {
    expect(dropTopMip(makeKtx2(2, 256, 3))).toBeNull();
    expect(dropTopMip(makeKtx2(2, 1024, 1))).toBeNull();
    expect(dropTopMip(new TextEncoder().encode('version https://git-lfs.github.com/spec/v1'))).toBeNull();
  });

  // The real textures are in Git LFS, so this only runs where they have been pulled.
  const dir = path.resolve(import.meta.dirname, '../../public/assets/textures');
  const real = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.ktx2')) : [];
  const pulled = real.filter((f) => fs.statSync(path.join(dir, f)).size > 1024);
  it.skipIf(pulled.length === 0)('shrinks every pulled texture and keeps it well formed', () => {
    for (const f of pulled) {
      const src = new Uint8Array(fs.readFileSync(path.join(dir, f)));
      const out = dropTopMip(src);
      if (!out) continue;
      const a = read(src);
      const b = read(out);
      expect(b.levels).toBe(a.levels - 1);
      expect(b.width).toBe(a.width / 2);
      expect(out.length).toBeLessThan(src.length * 0.5);
      for (let i = 0; i < b.levels; i++) expect(Buffer.compare(b.level(i).bytes, a.level(i + 1).bytes)).toBe(0);
    }
  });
});
