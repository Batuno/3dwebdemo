// The API on a computer: node:http in front of the shared app, plus the built sites from dist/.
// Free to run anywhere Node 22 runs; see README.md for putting it online with Cloudflare instead.
import fs from 'node:fs';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { deriveLoginKey, newSalt } from '@bair/project-data';
import { createApp, type AppOptions } from '../app';
import { createUser, randomToken, userCount } from '../auth';
import type { SqlDb } from '../db';
import { openSqlite } from './sqlite';
import { serveStatic } from './static';

/** The repository: the nearest folder above this file with pnpm-workspace.yaml in it. */
function findRoot(from: string): string {
  for (let dir = from; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    if (path.dirname(dir) === dir) return process.cwd();
  }
}
const ROOT = findRoot(import.meta.dirname);
const BODY_LIMIT = 1024 * 1024;

export interface NodeConfig extends AppOptions {
  port: number;
  host: string;
  dbFile: string;
  /** Built sites to serve; null serves only the API. */
  staticDir: string | null;
  /** Read the client address and https from X-Forwarded-* (behind nginx, Caddy or a tunnel). */
  trustProxy: boolean;
  adminEmail?: string;
  adminPassword?: string;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): NodeConfig {
  const staticDir = env.STATIC_DIR ?? path.join(ROOT, 'dist');
  const origins = (env.CORS_ORIGINS ?? '*').trim();
  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '0.0.0.0',
    dbFile: env.DB_FILE ?? path.join(env.DATA_DIR ?? path.join(ROOT, 'data'), 'bair.sqlite'),
    staticDir: staticDir && fs.existsSync(staticDir) ? staticDir : null,
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    corsOrigins: origins === '*' ? '*' : origins.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean),
    // Printed at start-up when the database has no users yet, so whoever started the server can claim it.
    setupCode: env.SETUP_CODE || randomToken(6),
    adminEmail: env.ADMIN_EMAIL || undefined,
    adminPassword: env.ADMIN_PASSWORD || undefined,
  };
}

function readBody(req: IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > BODY_LIMIT) {
        resolve(null);
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const COMPRESSIBLE = /^(application\/json|text\/)/;

export async function writeResponse(req: IncomingMessage, res: ServerResponse, response: Response) {
  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((v, k) => {
    if (k !== 'set-cookie') headers[k] = v;
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) headers['set-cookie'] = cookies;
  let body = Buffer.from(await response.arrayBuffer());
  if (body.length > 1024 && COMPRESSIBLE.test(response.headers.get('content-type') ?? '') && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
    body = gzipSync(body);
    headers['content-encoding'] = 'gzip';
    headers.vary = 'Accept-Encoding';
  }
  if (response.status !== 204 && response.status !== 304) headers['content-length'] = String(body.length);
  res.writeHead(response.status, headers);
  res.end(req.method === 'HEAD' || response.status === 204 || response.status === 304 ? undefined : body);
}

/** First superadmin from ADMIN_EMAIL / ADMIN_PASSWORD, for unattended set-ups. Otherwise the setup page is used. */
export async function bootstrapFromEnv(db: SqlDb, cfg: NodeConfig): Promise<boolean> {
  if (!cfg.adminEmail || !cfg.adminPassword || (await userCount(db)) > 0) return false;
  const salt = newSalt();
  await createUser(db, { email: cfg.adminEmail, name: 'Ерөнхий админ', role: 'superadmin', salt, key: await deriveLoginKey(cfg.adminPassword, salt) });
  return true;
}

export async function startServer(cfg: NodeConfig = configFromEnv()) {
  const db = openSqlite(cfg.dbFile);
  const app = createApp(db, cfg);
  await app.ready();
  const created = await bootstrapFromEnv(db, cfg);

  const server = http.createServer(async (req, res) => {
    try {
      const proto = cfg.trustProxy && req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const host = (cfg.trustProxy && (req.headers['x-forwarded-host'] as string)) || req.headers.host || `localhost:${cfg.port}`;
      const url = new URL(req.url ?? '/', `${proto}://${host}`);
      if (!url.pathname.startsWith('/api/')) {
        if (cfg.staticDir && (req.method === 'GET' || req.method === 'HEAD') && serveStatic(cfg.staticDir, req, res, url.pathname)) return;
        res.writeHead(url.pathname === '/' && !cfg.staticDir ? 302 : 404, url.pathname === '/' && !cfg.staticDir ? { Location: '/api/health' } : { 'Content-Type': 'text/plain' });
        res.end(url.pathname === '/' && !cfg.staticDir ? undefined : 'Not found');
        return;
      }
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
      if (body === null) {
        res.writeHead(413).end();
        return;
      }
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
        else if (v !== undefined) headers.set(k, v);
      }
      const ip = (cfg.trustProxy && String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
      const response = await app.handle(new Request(url, { method: req.method, headers, body: body?.length ? body : undefined }), { ip, secure: proto === 'https' });
      await writeResponse(req, res, response);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.writeHead(500).end();
    }
  });

  // Daily upkeep: an hour after start, then every 24 hours.
  const upkeep = () => app.maintain().catch((e) => console.error('Upkeep failed', e));
  const timer = setInterval(upkeep, 24 * 3600_000);
  timer.unref();
  setTimeout(upkeep, 3600_000).unref();

  await new Promise<void>((resolve) => server.listen(cfg.port, cfg.host, resolve));
  const base = `http://localhost:${cfg.port}`;
  console.log(`\nAPI and sites on ${base}  (admin: ${base}/admin/)`);
  console.log(`Database: ${cfg.dbFile}`);
  if (!cfg.staticDir) console.log('No dist/ folder: only the API is served. Run `pnpm build` to serve the sites too, or `pnpm dev:admin` for the admin.');
  if (created) console.log(`Created superadmin ${cfg.adminEmail} from ADMIN_EMAIL / ADMIN_PASSWORD.`);
  else if ((await userCount(db)) === 0) console.log(`\nNo users yet. Open the admin and create the first one with this setup code: ${cfg.setupCode}\n`);
  return { server, db, app };
}
