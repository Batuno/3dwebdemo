// The API on Cloudflare's free plan: a Worker with a D1 database. Cloudflare serves the built sites in dist/
// itself (free and unmetered); only /api/ requests reach this code. Deploy with `pnpm cf:deploy`.
import { createApp, type App } from './app';
import type { Param, SqlDb } from './db';

/* Just the parts of the D1 API used here, to avoid a dependency on @cloudflare/workers-types. */
interface D1Result<T> {
  results: T[];
  meta: { changes: number; last_row_id: number };
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
  run(): Promise<D1Result<unknown>>;
}
interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown>;
}
interface Fetcher {
  fetch(request: Request): Promise<Response>;
}
interface ExecutionContext {
  waitUntil(p: Promise<unknown>): void;
}

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  /** Unlocks creating the first superadmin. Set it with `wrangler secret put SETUP_CODE` (pnpm cf:setup does). */
  SETUP_CODE?: string;
  /** Comma-separated origins allowed to call the public API, when the showroom is hosted elsewhere. Default: any. */
  CORS_ORIGINS?: string;
}

const bind = (params: Param[]) => params.map((p) => (p === undefined ? null : p));

export function d1(db: D1Database): SqlDb {
  return {
    async all<T>(sql: string, ...params: Param[]) {
      return (await db.prepare(sql).bind(...bind(params)).all<T>()).results;
    },
    async get<T>(sql: string, ...params: Param[]) {
      return (await db.prepare(sql).bind(...bind(params)).first<T>()) ?? undefined;
    },
    async run(sql: string, ...params: Param[]) {
      const r = await db.prepare(sql).bind(...bind(params)).run();
      return { changes: r.meta.changes, lastId: r.meta.last_row_id };
    },
    async batch(statements) {
      if (statements.length) await db.batch(statements.map((s) => db.prepare(s.sql).bind(...bind(s.params ?? []))));
    },
  };
}

// One app per isolate: its migration check and the showroom snapshot memo then last across requests.
let app: App | null = null;
let appDb: D1Database | null = null;

function appFor(env: Env): App {
  if (!app || appDb !== env.DB) {
    const origins = (env.CORS_ORIGINS ?? '*').trim();
    app = createApp(d1(env.DB), {
      corsOrigins: origins === '*' || !origins ? '*' : origins.split(',').map((o) => o.trim().replace(/\/$/, '')),
      setupCode: env.SETUP_CODE?.trim() || undefined,
    });
    appDb = env.DB;
  }
  return app;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return appFor(env).handle(request, {
        ip: request.headers.get('cf-connecting-ip') ?? 'unknown',
        secure: url.protocol === 'https:',
        waitUntil: (p) => ctx.waitUntil(p),
      });
    }
    // Paths with no file behind them.
    if (url.pathname === '/admin') return Response.redirect(new URL('/admin/', url).toString(), 301);
    if (url.pathname === '/showroom') return Response.redirect(new URL('/showroom/', url).toString(), 301);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },

  /** The nightly Cron Trigger in wrangler.jsonc. */
  async scheduled(_event: unknown, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(appFor(env).maintain());
  },
};
