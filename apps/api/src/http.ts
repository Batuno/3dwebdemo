// Routing and request helpers on the web-standard Request and Response, so the same code runs in Node
// and in Cloudflare Workers. Handlers return plain data (sent as JSON) or a Response.

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const badRequest = (code: string, message?: string) => new HttpError(400, code, message);
export const notFound = () => new HttpError(404, 'not_found');

type Handler<C> = (ctx: C) => unknown | Promise<unknown>;

interface Route<C> {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler<C>;
}

export class Router<C> {
  private routes: Route<C>[] = [];

  on(method: string, path: string, handler: Handler<C>): this {
    const keys: string[] = [];
    const pattern = new RegExp(
      '^' +
        path.replace(/\//g, '\\/').replace(/:(\w+)/g, (_, k: string) => {
          keys.push(k);
          return '([^/]+)';
        }) +
        '$',
    );
    this.routes.push({ method, pattern, keys, handler });
    return this;
  }
  get = (path: string, h: Handler<C>) => this.on('GET', path, h);
  post = (path: string, h: Handler<C>) => this.on('POST', path, h);
  patch = (path: string, h: Handler<C>) => this.on('PATCH', path, h);
  delete = (path: string, h: Handler<C>) => this.on('DELETE', path, h);

  /** The handler for a request, or which methods the path takes when the method is wrong. */
  match(method: string, pathname: string): { handler: Handler<C>; params: Record<string, string> } | { allowed: string[] } | null {
    const allowed: string[] = [];
    for (const r of this.routes) {
      const m = r.pattern.exec(pathname);
      if (!m) continue;
      if (r.method !== method && !(method === 'HEAD' && r.method === 'GET')) {
        allowed.push(r.method);
        continue;
      }
      const params: Record<string, string> = {};
      try {
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      } catch {
        return null;
      }
      return { handler: r.handler, params };
    }
    return allowed.length ? { allowed } : null;
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function download(body: string | Uint8Array, filename: string, type: string): Response {
  return new Response(body as ConstructorParameters<typeof Response>[0], {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/** Reads a JSON object body of at most `limit` bytes. Accepts text/plain, which beacons send to skip CORS preflight. */
export async function readJson(req: Request, limit: number): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > limit) throw new HttpError(413, 'too_large');
  const text = await req.text();
  if (text.length > limit) throw new HttpError(413, 'too_large');
  if (!text) return {};
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    throw badRequest('bad_json');
  }
  return obj(v);
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      // A cookie we did not set; ignore it.
    }
  }
  return out;
}

/* ---------- Validation ---------- */

export function obj(v: unknown): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw badRequest('invalid', 'Expected a JSON object');
  return v as Record<string, unknown>;
}

const empty = (v: unknown) => v === undefined || v === null || v === '';

export function str(v: unknown, field: string, { min = 0, max = 200, optional = false } = {}): string | undefined {
  if (empty(v)) {
    if (optional) return undefined;
    throw badRequest('invalid', `${field} is required`);
  }
  if (typeof v !== 'string') throw badRequest('invalid', `${field} must be text`);
  const s = v.trim();
  if (s.length < min || s.length > max) throw badRequest('invalid', `${field} must be ${min}-${max} characters`);
  if (!s && !optional) throw badRequest('invalid', `${field} is required`);
  return s || undefined;
}

export function int(v: unknown, field: string, { min = -Infinity, max = Infinity, optional = false } = {}): number | undefined {
  if (empty(v)) {
    if (optional) return undefined;
    throw badRequest('invalid', `${field} is required`);
  }
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
    throw badRequest('invalid', `${field} must be a whole number from ${min} to ${max}`);
  }
  return n;
}

export function num(v: unknown, field: string, { min = -Infinity, max = Infinity, optional = false } = {}): number | undefined {
  if (empty(v)) {
    if (optional) return undefined;
    throw badRequest('invalid', `${field} is required`);
  }
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw badRequest('invalid', `${field} must be from ${min} to ${max}`);
  return n;
}

export function oneOf<T extends string>(v: unknown, field: string, values: readonly T[], optional = false): T | undefined {
  if (empty(v) && optional) return undefined;
  if (typeof v !== 'string' || !values.includes(v as T)) throw badRequest('invalid', `${field} must be one of ${values.join(', ')}`);
  return v as T;
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function date(v: unknown, field: string, optional = true): string | undefined {
  if (empty(v) && optional) return undefined;
  if (typeof v !== 'string' || !DATE_RE.test(v) || Number.isNaN(Date.parse(v))) throw badRequest('invalid', `${field} must be YYYY-MM-DD`);
  return v;
}
