/// <reference types="vitest/config" />
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { halveHdr } from './src/lib/hdrLite.ts';
import { dropTopMip } from './src/lib/ktx2Lite.ts';

const ASSETS = path.resolve(import.meta.dirname, 'public/assets');
const LITE_URL = /\/assets\/(textures|hdri)\/lite\/([\w-]+\.(?:ktx2|hdr))(?:\?.*)?$/;
const SHRINK: Record<string, (src: Uint8Array) => Uint8Array | null> = { '.ktx2': dropTopMip, '.hdr': halveHdr };

/** The half-resolution copy of an asset, or the original when it can't be shrunk (e.g. an LFS pointer). */
function lite(dir: string, file: string): Uint8Array {
  const src = new Uint8Array(fs.readFileSync(path.join(ASSETS, dir, file)));
  return SHRINK[path.extname(file)]?.(src) ?? src;
}

/**
 * Phones load assets/{textures,hdri}/lite/: the textures one mip level down and the image lights at half
 * size (src/lib/ktx2Lite.ts, src/lib/hdrLite.ts). Made on the fly in dev and written next to the
 * originals in a build, so no extra binaries live in git.
 */
function liteAssets(): Plugin {
  return {
    name: 'bair-lite-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(LITE_URL);
        if (!m || !fs.existsSync(path.join(ASSETS, m[1], m[2]))) return next();
        res.setHeader('Content-Type', m[2].endsWith('.ktx2') ? 'image/ktx2' : 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(Buffer.from(lite(m[1], m[2])));
      });
    },
    generateBundle() {
      for (const [dir, ext] of [
        ['textures', '.ktx2'],
        ['hdri', '.hdr'],
      ]) {
        if (!fs.existsSync(path.join(ASSETS, dir))) continue;
        for (const file of fs.readdirSync(path.join(ASSETS, dir)).filter((f) => f.endsWith(ext))) {
          this.emitFile({ type: 'asset', fileName: `assets/${dir}/lite/${file}`, source: lite(dir, file) });
        }
      }
    },
  };
}

// GitHub Pages serves from /<repo>/; the workflow passes VITE_BASE. Local dev uses '/'.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss(), liteAssets()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
