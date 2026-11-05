// Every route of the API. Runtime-free: Node (node/server.ts) and Cloudflare Workers (worker.ts) both pass
// requests to the handler createApp returns.
import { isLoginKey, isSalt, LEAD_SOURCES, LOGIN_KDF, type LeadSource } from '@bair/project-data';
import {
  checkLogin,
  clearedCookie,
  createSession,
  createUser,
  deleteSession,
  deleteUserSessions,
  hasRole,
  loginChallenge,
  ROLES,
  safeEqual,
  SESSION_COOKIE,
  sessionCookie,
  throttleClear,
  throttleCount,
  throttleHit,
  userCount,
  userForToken,
  verifierFor,
  type Role,
  type User,
} from './auth';
import { migrate, nowIso, type SqlDb, type Statement } from './db';
import { badRequest, HttpError, int, json, notFound, num, oneOf, parseCookies, readJson, Router, str } from './http';
import { analytics, ingest, pruneVisits, rangeFor, unitInterest } from './services/analytics';
import { auditStatement } from './services/audit';
import { dashboard } from './services/dashboard';
import {
  dropSnapshotStatement,
  forgetSnapshot,
  isUnitId,
  itemHistory,
  listBays,
  listUnits,
  parsePatch,
  planUpdate,
  publishedSnapshot,
} from './services/inventory';
import {
  activityStatement,
  createLead,
  getLead,
  leadActivity,
  leadJourney,
  listLeads,
  parseLeadFilter,
  parseLeadInput,
  parseLeadPatch,
  planLeadUpdate,
  samePhone,
} from './services/leads';
import { getPricing, setPricingStatement } from './services/settings';

export interface AppOptions {
  /** Origins allowed to call the public API from a browser; '*' allows any. */
  corsOrigins: string[] | '*';
  /** Code that unlocks creating the first superadmin on an empty database. Unset disables that. */
  setupCode?: string;
  /** Visit rows (a lead's path through the showroom) are kept this many days. */
  visitDays?: number;
}

export interface RequestInfo {
  ip: string;
  /** The request came over https, so cookies are marked Secure. */
  secure: boolean;
  waitUntil?: (p: Promise<unknown>) => void;
}

interface Ctx {
  req: Request;
  url: URL;
  params: Record<string, string>;
  info: RequestInfo;
  db: SqlDb;
  user: User | null;
  token: string | undefined;
  body: () => Promise<Record<string, unknown>>;
  /** The signed-in user, if their role is at least `role`; otherwise 401 or 403. */
  need: (role: Role) => User;
}

const BODY_LIMIT = 64 * 1024;
const LOGIN_FAILS_PER_EMAIL = 5;
const LOGIN_FAILS_PER_IP = 30;
const LOGIN_WINDOW = 15 * 60;
const LEADS_PER_IP_HOUR = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MANUAL_SOURCES = LEAD_SOURCES.filter((s) => s !== 'showroom' && s !== 'website') as LeadSource[];

const publicUser = (u: User) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

export function createApp(db: SqlDb, opts: AppOptions) {
  let ready: Promise<void> | null = null;
  const prepare = () => (ready ??= migrate(db).catch((e) => {
    ready = null;
    throw e;
  }));

  const r = new Router<Ctx>();

  /* ---------- Public: the showroom and the website ---------- */

  r.get('/api/health', () => ({ ok: true, time: nowIso() }));

  r.get('/api/public/inventory', async ({ req }) => {
    const snap = await publishedSnapshot(db);
    const headers = { ETag: snap.etag, 'Cache-Control': 'no-cache', 'Content-Type': 'application/json; charset=utf-8' };
    if (req.headers.get('if-none-match') === snap.etag) return new Response(null, { status: 304, headers });
    return new Response(snap.body, { headers });
  });

  r.post('/api/public/leads', async ({ body, info }) => {
    const b = await body();
    // The honeypot field is hidden from people; a bot that fills it is told it worked.
    if (typeof b.website === 'string' && b.website.trim()) return { ok: true };
    if ((await throttleHit(db, `lead:${info.ip}`, 3600)) > LEADS_PER_IP_HOUR) throw new HttpError(429, 'too_many');
    const lead = parseLeadInput(b, ['showroom', 'website']);
    const id = await createLead(db, lead);
    return { ok: true, id };
  });

  r.post('/api/public/events', async ({ body }) => ({ kept: await ingest(db, await body()) }));

  /* ---------- Signing in ---------- */

  r.get('/api/auth/state', async ({ user }) => ({
    user: user ? publicUser(user) : null,
    needsSetup: !user && (await userCount(db)) === 0,
    setupEnabled: !!opts.setupCode,
    kdf: { iterations: LOGIN_KDF.iterations },
  }));

  r.post('/api/auth/challenge', async ({ body }) => {
    const email = str((await body()).email, 'email', { max: 120 })!;
    return loginChallenge(db, email);
  });

  r.post('/api/auth/login', async ({ body, info, req }) => {
    const b = await body();
    const email = str(b.email, 'email', { max: 120 })!.toLowerCase();
    if (!isLoginKey(b.key)) throw badRequest('invalid', 'key');
    const emailKey = `login:${email}`;
    const ipKey = `login-ip:${info.ip}`;
    if ((await throttleCount(db, emailKey)) >= LOGIN_FAILS_PER_EMAIL || (await throttleCount(db, ipKey)) >= LOGIN_FAILS_PER_IP) {
      throw new HttpError(429, 'locked');
    }
    const user = await checkLogin(db, email, b.key);
    if (!user) {
      await throttleHit(db, emailKey, LOGIN_WINDOW);
      await throttleHit(db, ipKey, LOGIN_WINDOW);
      await db.batch([auditStatement(null, 'login_failed', email, undefined, info.ip)]);
      throw new HttpError(401, 'bad_login');
    }
    await throttleClear(db, emailKey);
    const token = await createSession(db, user.id, info.ip, req.headers.get('user-agent') ?? '');
    await db.batch([auditStatement(user.id, 'login', null, undefined, info.ip)]);
    return json({ user: publicUser(user) }, 200, { 'Set-Cookie': sessionCookie(token, info.secure) });
  });

  r.post('/api/auth/setup', async ({ body, info, req }) => {
    const b = await body();
    if ((await userCount(db)) > 0) throw new HttpError(409, 'already_set_up');
    if (!opts.setupCode) throw new HttpError(403, 'setup_disabled');
    if ((await throttleHit(db, `setup:${info.ip}`, LOGIN_WINDOW)) > 10) throw new HttpError(429, 'locked');
    if (typeof b.code !== 'string' || !safeEqual(b.code.trim(), opts.setupCode)) throw new HttpError(403, 'bad_code');
    const email = str(b.email, 'email', { max: 120 })!;
    if (!EMAIL_RE.test(email)) throw badRequest('invalid', 'email');
    if (!isSalt(b.salt) || !isLoginKey(b.key)) throw badRequest('invalid', 'key');
    const id = await createUser(db, { email, name: str(b.name, 'name', { min: 1, max: 80 })!, role: 'superadmin', salt: b.salt, key: b.key });
    const token = await createSession(db, id, info.ip, req.headers.get('user-agent') ?? '');
    await db.batch([auditStatement(id, 'user.create', email, { role: 'superadmin', setup: true }, info.ip)]);
    const user = (await userForToken(db, token))!;
    return json({ user: publicUser(user) }, 200, { 'Set-Cookie': sessionCookie(token, info.secure) });
  });

  r.post('/api/auth/logout', async ({ token, user, info }) => {
    await deleteSession(db, token);
    if (user) await db.batch([auditStatement(user.id, 'logout', null, undefined, info.ip)]);
    return json({ ok: true }, 200, { 'Set-Cookie': clearedCookie(info.secure) });
  });

  r.post('/api/auth/password', async ({ need, body, token, info }) => {
    const me = need('sales');
    const b = await body();
    if (!isLoginKey(b.currentKey) || !isSalt(b.salt) || !isLoginKey(b.key)) throw badRequest('invalid', 'key');
    if (!(await checkLogin(db, me.email, b.currentKey))) throw new HttpError(403, 'wrong_password');
    await db.batch([
      { sql: 'UPDATE users SET salt = ?, iterations = ?, verifier = ? WHERE id = ?', params: [b.salt, LOGIN_KDF.iterations, await verifierFor(b.key), me.id] },
      auditStatement(me.id, 'password', null, undefined, info.ip),
    ]);
    await deleteUserSessions(db, me.id, token);
    return { ok: true };
  });

  /* ---------- Dashboard and analytics ---------- */

  r.get('/api/dashboard', ({ need }) => {
    need('sales');
    return dashboard(db);
  });

  const daysParam = (url: URL) => int(url.searchParams.get('days') ?? '30', 'days', { min: 0, max: 3650 })!;

  r.get('/api/analytics', async ({ need, url }) => {
    need('sales');
    return analytics(db, await rangeFor(db, daysParam(url)));
  });

  /* ---------- Leads ---------- */

  r.get('/api/leads', async ({ need, url }) => {
    need('sales');
    return { leads: await listLeads(db, parseLeadFilter(url.searchParams)) };
  });

  r.post('/api/leads', async ({ need, body, info }) => {
    const me = need('sales');
    const b = await body();
    const input = parseLeadInput({ ...b, source: b.source ?? 'phone' }, MANUAL_SOURCES);
    const id = await createLead(db, { ...input, assignedTo: me.role === 'sales' ? me.id : null });
    const note = str(b.note, 'note', { max: 2000, optional: true });
    await db.batch([...(note ? [activityStatement(id, me.id, 'note', note)] : []), auditStatement(me.id, 'lead.create', String(id), { source: input.source }, info.ip)]);
    return { id };
  });

  const leadParam = async (params: Record<string, string>) => {
    const id = int(params.id, 'id', { min: 1 })!;
    const lead = await getLead(db, id);
    if (!lead) throw notFound();
    return lead;
  };

  r.get('/api/leads/:id', async ({ need, params }) => {
    need('sales');
    const lead = await leadParam(params);
    const [activity, journey, others, unit] = await Promise.all([
      leadActivity(db, lead.id),
      leadJourney(db, lead),
      samePhone(db, lead),
      lead.unit_id ? listUnits(db).then((l) => l.find((u) => u.id === lead.unit_id) ?? null) : null,
    ]);
    return { lead, activity, journey, others, unit };
  });

  r.patch('/api/leads/:id', async ({ need, params, body, info }) => {
    const me = need('sales');
    const lead = await leadParam(params);
    const plan = await planLeadUpdate(db, lead, parseLeadPatch(await body()), me.id);
    if (plan.statements.length) await db.batch([...plan.statements, auditStatement(me.id, 'lead.update', String(lead.id), plan.fields, info.ip)]);
    return { changed: plan.fields, lead: await getLead(db, lead.id) };
  });

  r.post('/api/leads/:id/notes', async ({ need, params, body, info }) => {
    const me = need('sales');
    const lead = await leadParam(params);
    const text = str((await body()).body, 'body', { min: 1, max: 2000 })!;
    await db.batch([
      activityStatement(lead.id, me.id, 'note', text),
      { sql: 'UPDATE leads SET updated_at = ? WHERE id = ?', params: [nowIso(), lead.id] },
      auditStatement(me.id, 'lead.note', String(lead.id), undefined, info.ip),
    ]);
    return { ok: true };
  });

  r.delete('/api/leads/:id', async ({ need, params, info }) => {
    const me = need('superadmin');
    const lead = await leadParam(params);
    await db.batch([
      { sql: 'UPDATE inventory SET lead_id = NULL WHERE lead_id = ?', params: [lead.id] },
      { sql: 'DELETE FROM leads WHERE id = ?', params: [lead.id] },
      auditStatement(me.id, 'lead.delete', String(lead.id), { name: lead.name, unit: lead.unit_id }, info.ip),
    ]);
    return { ok: true };
  });

  /* ---------- Flats and parking ---------- */

  r.get('/api/units', async ({ need, url, user }) => {
    need('sales');
    const range = await rangeFor(db, daysParam(url) || 30);
    const [units, interest, leadCounts, pricing] = await Promise.all([
      listUnits(db),
      unitInterest(db, range),
      db.all<{ id: string; n: number }>("SELECT unit_id AS id, COUNT(*) AS n FROM leads WHERE unit_id IS NOT NULL AND status != 'lost' GROUP BY unit_id"),
      getPricing(db),
    ]);
    return { units, interest, leadCounts: Object.fromEntries(leadCounts.map((x) => [x.id, x.n])), pricing, canEdit: hasRole(user!.role, 'admin') };
  });

  r.get('/api/units/:id', async ({ need, params }) => {
    need('sales');
    if (!isUnitId(params.id)) throw notFound();
    const [unit, history, leads] = await Promise.all([
      listUnits(db).then((l) => l.find((u) => u.id === params.id)!),
      itemHistory(db, params.id),
      listLeads(db, { unit: params.id }),
    ]);
    return { unit, history, leads };
  });

  const changeItems = (kind: 'unit' | 'bay') => async ({ need, body, info }: Ctx) => {
    const me = need('admin');
    const b = await body();
    if (!Array.isArray(b.ids) || !b.ids.every((x) => typeof x === 'string')) throw badRequest('invalid', 'ids');
    const patch = parsePatch(typeof b.set === 'object' && b.set ? (b.set as Record<string, unknown>) : {});
    const plan = await planUpdate(db, kind, b.ids as string[], patch, me.id);
    if (plan.changed.length) {
      await db.batch([
        ...plan.statements,
        ...plan.linked.map((l) => activityStatement(l.leadId, me.id, 'inventory', `${l.itemId}:${l.status}`)),
        auditStatement(me.id, `${kind}.update`, plan.changed.length === 1 ? plan.changed[0] : `${plan.changed.length}`, { ids: plan.changed.slice(0, 50), set: patch }, info.ip),
      ]);
      forgetSnapshot();
    }
    return { changed: plan.changed };
  };
  r.patch('/api/units', changeItems('unit'));
  r.patch('/api/bays', changeItems('bay'));

  r.get('/api/bays', async ({ need, user }) => {
    need('sales');
    return { bays: await listBays(db), canEdit: hasRole(user!.role, 'admin') };
  });

  r.get('/api/bays/:id', async ({ need, params }) => {
    need('sales');
    const bays = await listBays(db);
    const bay = bays.find((b) => b.id === params.id);
    if (!bay) throw notFound();
    return { bay, history: await itemHistory(db, bay.id) };
  });

  /* ---------- Exports ---------- */

  // The admin panel builds CSV and Excel files itself from the data it already has (that work would not fit
  // the free plan's CPU limit here) and records each export, so the audit log still shows who took what.
  r.post('/api/audit/export', async ({ need, body, info }) => {
    const me = need('admin');
    const b = await body();
    const what = oneOf(b.what, 'what', ['leads', 'units', 'bays', 'analytics', 'all'] as const)!;
    const format = oneOf(b.format, 'format', ['xlsx', 'csv'] as const)!;
    const rows = int(b.rows, 'rows', { min: 0, max: 1_000_000 })!;
    const filter = typeof b.filter === 'object' && b.filter ? b.filter : undefined;
    await db.batch([auditStatement(me.id, 'export', what, { format, rows, filter }, info.ip)]);
    return { ok: true };
  });

  /* ---------- Users ---------- */

  r.get('/api/users/options', async ({ need }) => {
    need('sales');
    return { users: await db.all('SELECT id, name, role FROM users WHERE active = 1 ORDER BY name') };
  });

  r.get('/api/users', async ({ need }) => {
    need('superadmin');
    return { users: await db.all('SELECT id, email, name, role, active, created_at AS createdAt, last_login_at AS lastLoginAt FROM users ORDER BY created_at') };
  });

  r.post('/api/users', async ({ need, body, info }) => {
    const me = need('superadmin');
    const b = await body();
    const email = str(b.email, 'email', { max: 120 })!;
    if (!EMAIL_RE.test(email)) throw badRequest('invalid', 'email');
    if (!isSalt(b.salt) || !isLoginKey(b.key)) throw badRequest('invalid', 'key');
    const role = oneOf(b.role, 'role', ROLES)!;
    if (await db.get('SELECT 1 AS x FROM users WHERE email = ?', email.toLowerCase())) throw new HttpError(409, 'email_taken');
    const id = await createUser(db, { email, name: str(b.name, 'name', { min: 1, max: 80 })!, role, salt: b.salt, key: b.key });
    await db.batch([auditStatement(me.id, 'user.create', email, { role }, info.ip)]);
    return { id };
  });

  r.patch('/api/users/:id', async ({ need, params, body, info }) => {
    const me = need('superadmin');
    const id = int(params.id, 'id', { min: 1 })!;
    const target = await db.get<User>('SELECT id, email, name, role, active FROM users WHERE id = ?', id);
    if (!target) throw notFound();
    const b = await body();
    const sets: string[] = [];
    const args: (string | number)[] = [];
    const changed: string[] = [];
    if ('name' in b) {
      sets.push('name = ?');
      args.push(str(b.name, 'name', { min: 1, max: 80 })!);
      changed.push('name');
    }
    const role = 'role' in b ? oneOf(b.role, 'role', ROLES)! : target.role;
    const active = 'active' in b ? (b.active ? 1 : 0) : target.active;
    if (target.id === me.id && (role !== target.role || !active)) throw badRequest('self', 'You cannot change your own role or switch yourself off');
    if (target.role === 'superadmin' && target.active && (role !== 'superadmin' || !active)) {
      const others = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin' AND active = 1 AND id != ?", id);
      if (!others?.n) throw badRequest('last_superadmin');
    }
    if (role !== target.role) {
      sets.push('role = ?');
      args.push(role);
      changed.push('role');
    }
    if (active !== target.active) {
      sets.push('active = ?');
      args.push(active);
      changed.push('active');
    }
    const resetPassword = 'key' in b;
    if (resetPassword) {
      if (!isSalt(b.salt) || !isLoginKey(b.key)) throw badRequest('invalid', 'key');
      sets.push('salt = ?', 'iterations = ?', 'verifier = ?');
      args.push(b.salt, LOGIN_KDF.iterations, await verifierFor(b.key));
      changed.push('password');
    }
    if (!sets.length) return { changed };
    const statements: Statement[] = [{ sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params: [...args, id] }];
    // A switched-off user, a new role or a new password signs that user out everywhere.
    if (changed.some((c) => c !== 'name')) statements.push({ sql: 'DELETE FROM sessions WHERE user_id = ?', params: [id] });
    statements.push(auditStatement(me.id, 'user.update', target.email, changed, info.ip));
    await db.batch(statements);
    return { changed };
  });

  /* ---------- Settings and audit ---------- */

  r.get('/api/settings/pricing', async ({ need }) => {
    need('sales');
    return getPricing(db);
  });

  r.patch('/api/settings/pricing', async ({ need, body, info }) => {
    const me = need('superadmin');
    const b = await body();
    const current = await getPricing(db);
    const next = {
      pricePerM2: 'pricePerM2' in b ? int(b.pricePerM2, 'pricePerM2', { min: 100_000, max: 1_000_000_000 })! : current.pricePerM2,
      floorPremium: 'floorPremium' in b ? num(b.floorPremium, 'floorPremium', { min: 0, max: 0.05 })! : current.floorPremium,
      bayPrice: 'bayPrice' in b ? int(b.bayPrice, 'bayPrice', { min: 0, max: 10_000_000_000 })! : current.bayPrice,
    };
    await db.batch([setPricingStatement(next), dropSnapshotStatement, auditStatement(me.id, 'settings.pricing', null, { from: current, to: next }, info.ip)]);
    forgetSnapshot();
    return next;
  });

  r.get('/api/audit', async ({ need, url }) => {
    need('superadmin');
    const before = int(url.searchParams.get('before'), 'before', { min: 1, optional: true });
    const limit = int(url.searchParams.get('limit') ?? '100', 'limit', { min: 1, max: 500 })!;
    const rows = await db.all(
      `SELECT a.id, a.ts, a.action, a.target, a.detail, a.ip, u.name AS user FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
       ${before ? 'WHERE a.id < ?' : ''} ORDER BY a.id DESC LIMIT ?`,
      ...(before ? [before, limit] : [limit]),
    );
    return { entries: rows };
  });

  /* ---------- The handler ---------- */

  const corsHeaders = (req: Request): Record<string, string> => {
    const origin = req.headers.get('origin');
    if (opts.corsOrigins === '*') return { 'Access-Control-Allow-Origin': '*' };
    if (origin && opts.corsOrigins.includes(origin)) return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
    return {};
  };

  async function handle(req: Request, info: RequestInfo): Promise<Response> {
    const url = new URL(req.url);
    const isPublic = url.pathname.startsWith('/api/public/') || url.pathname === '/api/health';
    const extra = isPublic ? corsHeaders(req) : {};

    if (req.method === 'OPTIONS' && isPublic) {
      return new Response(null, {
        status: 204,
        headers: { ...extra, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' },
      });
    }

    let res: Response;
    try {
      const m = r.match(req.method, url.pathname);
      if (!m) throw notFound();
      if ('allowed' in m) throw new HttpError(405, 'method_not_allowed');
      // The admin panel marks its writes with a header that a page on another site cannot send without
      // CORS, which these routes never grant. With SameSite=Strict cookies this stops cross-site requests.
      if (!isPublic && req.method !== 'GET' && req.method !== 'HEAD' && req.headers.get('x-bair-admin') !== '1') {
        throw new HttpError(403, 'missing_admin_header');
      }
      await prepare();
      const token = parseCookies(req.headers.get('cookie'))[SESSION_COOKIE];
      const user = isPublic ? null : await userForToken(db, token);
      let parsed: Promise<Record<string, unknown>> | null = null;
      const ctx: Ctx = {
        req,
        url,
        params: m.params,
        info,
        db,
        user,
        token,
        body: () => (parsed ??= readJson(req, BODY_LIMIT)),
        need: (role) => {
          if (!user) throw new HttpError(401, 'signed_out');
          if (!hasRole(user.role, role)) throw new HttpError(403, 'forbidden');
          return user;
        },
      };
      const out = await m.handler(ctx);
      res = out instanceof Response ? out : json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) res = json({ error: e.code, message: e.message }, e.status);
      else {
        console.error('API error', req.method, url.pathname, e);
        res = json({ error: 'server_error' }, 500);
      }
    }
    if (Object.keys(extra).length) {
      res = new Response(res.body, res);
      for (const [k, v] of Object.entries(extra)) res.headers.set(k, v);
    }
    res.headers.set('X-Content-Type-Options', 'nosniff');
    return res;
  }

  /** Daily upkeep: expired sessions and throttles, old visit rows, and a fresh showroom copy (sales may have ended). */
  async function maintain() {
    await prepare();
    const now = nowIso();
    await db.batch([
      { sql: 'DELETE FROM sessions WHERE expires_at < ?', params: [now] },
      { sql: 'DELETE FROM throttle WHERE reset_at < ?', params: [now] },
      dropSnapshotStatement,
    ]);
    await pruneVisits(db, opts.visitDays ?? 120);
    forgetSnapshot();
  }

  return { handle, maintain, ready: prepare };
}

export type App = ReturnType<typeof createApp>;
