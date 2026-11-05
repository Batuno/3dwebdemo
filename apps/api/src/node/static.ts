// Serves the built sites from one folder on a computer: website at /, showroom at /showroom/, admin at /admin/.
// On Cloudflare the platform serves them instead (worker.ts).
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { gzipSync } from 'node:zlib';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.ktx2': 'image/ktx2',
  '.hdr': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};
const COMPRESS = /\.(html|js|mjs|css|json|svg|txt|gltf|webmanifest|hdr)$/;

/** The admin panel's headers, the same as dist/_headers gives it on Cloudflare (tools/assemble-pages.mjs). */
export const ADMIN_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Frame-Options': 'DENY',
};

const gzCache = new Map<string, { mtime: number; data: Buffer }>();

/** Answers the request from `root` if a file matches. Returns false when nothing does. */
export function serveStatic(root: string, req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
  let rel: string;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  if (rel.includes('\0') || rel.split('/').some((p) => p.startsWith('.') && p !== '')) return false;
  let file = path.join(root, path.normalize(rel));
  if (file !== root && !file.startsWith(root + path.sep)) return false;

  let stat = fs.statSync(file, { throwIfNoEntry: false });
  if (stat?.isDirectory()) {
    if (!pathname.endsWith('/')) {
      res.writeHead(301, { Location: pathname + '/' });
      res.end();
      return true;
    }
    file = path.join(file, 'index.html');
    stat = fs.statSync(file, { throwIfNoEntry: false });
  }
  if (!stat?.isFile()) return false;

  const ext = path.extname(file).toLowerCase();
  const headers: Record<string, string> = {
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    // Vite puts a content hash in every file name under assets/, so those never change.
    'Cache-Control': ext === '.html' ? 'no-cache' : /\/assets\/[^/]+-[\w-]{8,}\.\w+$/.test(pathname) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    'Last-Modified': stat.mtime.toUTCString(),
    ...(pathname.startsWith('/admin/') ? ADMIN_HEADERS : {}),
  };
  const since = req.headers['if-modified-since'];
  if (since && Date.parse(since) >= Math.floor(stat.mtimeMs / 1000) * 1000) {
    res.writeHead(304, headers);
    res.end();
    return true;
  }

  if (COMPRESS.test(ext) && stat.size > 1024 && stat.size < 20 * 1024 * 1024 && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
    let hit = gzCache.get(file);
    if (!hit || hit.mtime !== stat.mtimeMs) {
      hit = { mtime: stat.mtimeMs, data: gzipSync(fs.readFileSync(file)) };
      gzCache.set(file, hit);
    }
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding', 'Content-Length': String(hit.data.length) });
    res.end(req.method === 'HEAD' ? undefined : hit.data);
    return true;
  }
  res.writeHead(200, { ...headers, 'Content-Length': String(stat.size) });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file).pipe(res);
  return true;
}
