import { beforeAll, describe, expect, it } from 'vitest';
import { deriveLoginKey, getUnit, newSalt, type InventorySnapshot } from '@bair/project-data';
import { createApp } from './app';
import { openSqlite } from './node/sqlite';

const SETUP = 'test-setup-code';
const db = openSqlite(':memory:');
const app = createApp(db, { corsOrigins: '*', setupCode: SETUP });

interface CallOpts {
  body?: unknown;
  cookie?: string;
  ip?: string;
  admin?: boolean;
  headers?: Record<string, string>;
}

async function call(method: string, path: string, o: CallOpts = {}) {
  const headers: Record<string, string> = { ...(o.headers ?? {}) };
  if (o.body !== undefined) headers['content-type'] = 'application/json';
  if (o.cookie) headers.cookie = o.cookie;
  if (o.admin !== false && method !== 'GET') headers['x-bair-admin'] = '1';
  const res = await app.handle(
    new Request(`http://test.local${path}`, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) }),
    { ip: o.ip ?? '10.0.0.1', secure: false },
  );
  const type = res.headers.get('content-type') ?? '';
  const raw = new Uint8Array(await res.clone().arrayBuffer());
  const data = res.status === 304 ? null : type.includes('json') ? await res.json() : type.includes('text') ? await res.text() : raw;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read whatever JSON came back
  return { status: res.status, data: data as any, res, raw };
}


const cookieOf = (res: Response) => res.headers.get('set-cookie')!.split(';')[0];

async function keyFor(email: string, password: string) {
  const { data } = await call('POST', '/api/auth/challenge', { body: { email } });
  return deriveLoginKey(password, data.salt, data.iterations);
}

async function login(email: string, password: string) {
  const r = await call('POST', '/api/auth/login', { body: { email, key: await keyFor(email, password) }, ip: '10.9.9.9' });
  expect(r.status).toBe(200);
  return cookieOf(r.res);
}

async function newUserBody(email: string, password: string, role: string, name = email) {
  const salt = newSalt();
  return { email, name, role, salt, key: await deriveLoginKey(password, salt) };
}

let superCookie = '';
let adminCookie = '';
let salesCookie = '';

beforeAll(async () => {
  const state = await call('GET', '/api/auth/state');
  expect(state.data.needsSetup).toBe(true);

  const salt = newSalt();
  const body = { code: 'wrong', name: 'Бат', email: 'owner@example.com', salt, key: await deriveLoginKey('owner-password', salt) };
  expect((await call('POST', '/api/auth/setup', { body })).status).toBe(403);
  const ok = await call('POST', '/api/auth/setup', { body: { ...body, code: SETUP } });
  expect(ok.status).toBe(200);
  expect(ok.data.user.role).toBe('superadmin');
  superCookie = cookieOf(ok.res);
  expect((await call('POST', '/api/auth/setup', { body: { ...body, code: SETUP } })).status).toBe(409);

  expect((await call('POST', '/api/users', { cookie: superCookie, body: await newUserBody('admin@example.com', 'admin-password', 'admin', 'Админ') })).status).toBe(200);
  expect((await call('POST', '/api/users', { cookie: superCookie, body: await newUserBody('sales@example.com', 'sales-password', 'sales', 'Сараа') })).status).toBe(200);
  adminCookie = await login('admin@example.com', 'admin-password');
  salesCookie = await login('sales@example.com', 'sales-password');
}, 60000);

describe('signing in', () => {
  it('gives unknown emails a stable salt that differs per email', async () => {
    const a = await call('POST', '/api/auth/challenge', { body: { email: 'nobody@example.com' } });
    const b = await call('POST', '/api/auth/challenge', { body: { email: 'nobody@example.com' } });
    const c = await call('POST', '/api/auth/challenge', { body: { email: 'other@example.com' } });
    expect(a.data.salt).toBe(b.data.salt);
    expect(a.data.salt).not.toBe(c.data.salt);
    expect(a.data.salt).toHaveLength(22);
  });

  it('locks an email after five wrong passwords', async () => {
    const wrong = await keyFor('admin@example.com', 'not-the-password');
    for (let i = 0; i < 5; i++) {
      expect((await call('POST', '/api/auth/login', { body: { email: 'admin@example.com', key: wrong }, ip: `10.1.1.${i}` })).status).toBe(401);
    }
    const right = await keyFor('admin@example.com', 'admin-password');
    expect((await call('POST', '/api/auth/login', { body: { email: 'admin@example.com', key: right }, ip: '10.1.1.99' })).status).toBe(429);
    await db.run("DELETE FROM throttle WHERE key LIKE 'login%'");
  });

  it('refuses admin writes without the admin header and reads without a session', async () => {
    expect((await call('PATCH', '/api/units', { cookie: adminCookie, admin: false, body: { ids: ['804A-12-325'], set: { status: 'sold' } } })).status).toBe(403);
    expect((await call('GET', '/api/leads')).status).toBe(401);
  });

  it('keeps each role to its own pages', async () => {
    expect((await call('PATCH', '/api/units', { cookie: salesCookie, body: { ids: ['804A-12-325'], set: { status: 'sold' } } })).status).toBe(403);
    expect((await call('POST', '/api/audit/export', { cookie: salesCookie, body: { what: 'leads', format: 'csv', rows: 1 } })).status).toBe(403);
    expect((await call('GET', '/api/users', { cookie: adminCookie })).status).toBe(403);
    expect((await call('GET', '/api/users/options', { cookie: salesCookie })).status).toBe(200);
  });

  it('protects the last superadmin and signs out a user whose password is reset', async () => {
    const users = (await call('GET', '/api/users', { cookie: superCookie })).data.users;
    const owner = users.find((u: { email: string }) => u.email === 'owner@example.com');
    const sales = users.find((u: { email: string }) => u.email === 'sales@example.com');
    expect((await call('PATCH', `/api/users/${owner.id}`, { cookie: superCookie, body: { active: false } })).status).toBe(400);
    const extra = await newUserBody('temp@example.com', 'temp-password', 'sales');
    await call('POST', '/api/users', { cookie: superCookie, body: extra });
    const tempCookie = await login('temp@example.com', 'temp-password');
    const temp = (await call('GET', '/api/users', { cookie: superCookie })).data.users.find((u: { email: string }) => u.email === 'temp@example.com');
    const salt = newSalt();
    await call('PATCH', `/api/users/${temp.id}`, { cookie: superCookie, body: { salt, key: await deriveLoginKey('new-password', salt) } });
    expect((await call('GET', '/api/leads', { cookie: tempCookie })).status).toBe(401);
    expect(sales.role).toBe('sales');
  });
});

describe('public leads', () => {
  it('stores a valid lead, rejects a bad phone and swallows the honeypot', async () => {
    const ok = await call('POST', '/api/public/leads', { admin: false, ip: '1.2.3.4', body: { kind: 'viewing', source: 'showroom', name: 'Болд', phone: '+976 9911-2233', unitId: '804A-12-325', date: '2026-12-01', time: '10:00' } });
    expect(ok.status).toBe(200);
    expect(ok.res.headers.get('access-control-allow-origin')).toBe('*');
    expect((await call('POST', '/api/public/leads', { admin: false, ip: '1.2.3.4', body: { kind: 'info', source: 'website', name: 'X', phone: '1234' } })).data.error).toBe('invalid_phone');
    const bot = await call('POST', '/api/public/leads', { admin: false, ip: '1.2.3.4', body: { kind: 'contact', source: 'website', name: 'Bot', phone: '99112233', website: 'spam' } });
    expect(bot.data.id).toBeUndefined();
    const list = (await call('GET', '/api/leads', { cookie: salesCookie })).data.leads;
    expect(list.some((l: { name: string }) => l.name === 'Bot')).toBe(false);
    const bold = list.find((l: { name: string }) => l.name === 'Болд');
    expect(bold.phone).toBe('99112233');
    expect(bold.status).toBe('new');
  });

  it('answers CORS preflight and limits leads per address', async () => {
    const pre = await app.handle(new Request('http://test.local/api/public/leads', { method: 'OPTIONS', headers: { origin: 'https://x.example' } }), { ip: '1.1.1.1', secure: false });
    expect(pre.status).toBe(204);
    const body = { kind: 'contact', source: 'website', name: 'Дорж', phone: '88112233' };
    const codes = [];
    for (let i = 0; i < 11; i++) codes.push((await call('POST', '/api/public/leads', { admin: false, ip: '5.5.5.5', body })).status);
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
    expect(codes[10]).toBe(429);
  });
});

describe('working leads', () => {
  it('finds Cyrillic names whatever the case, moves status and keeps a timeline', async () => {
    const found = (await call('GET', `/api/leads?q=${encodeURIComponent('БОЛД')}`, { cookie: salesCookie })).data.leads;
    expect(found).toHaveLength(1);
    const id = found[0].id;
    const users = (await call('GET', '/api/users/options', { cookie: salesCookie })).data.users;
    const sara = users.find((u: { name: string }) => u.name === 'Сараа');
    const p = await call('PATCH', `/api/leads/${id}`, { cookie: salesCookie, body: { status: 'meeting', assignedTo: sara.id, nextActionAt: '2026-11-10' } });
    expect(p.data.changed).toEqual(expect.arrayContaining(['status', 'assigned_to', 'next_action_at']));
    await call('POST', `/api/leads/${id}/notes`, { cookie: salesCookie, body: { body: 'Бямба гарагт уулзана' } });
    const detail = (await call('GET', `/api/leads/${id}`, { cookie: salesCookie })).data;
    expect(detail.lead.status).toBe('meeting');
    expect(detail.activity.map((a: { kind: string }) => a.kind)).toEqual(expect.arrayContaining(['status', 'assign', 'next_action', 'note']));
    expect(detail.unit.id).toBe('804A-12-325');
    expect((await call('GET', '/api/leads?status=meeting', { cookie: salesCookie })).data.leads).toHaveLength(1);
    expect((await call('DELETE', `/api/leads/${id}`, { cookie: adminCookie })).status).toBe(403);
  });

  it('adds a lead by hand, assigned to the salesperson who entered it', async () => {
    const r = await call('POST', '/api/leads', { cookie: salesCookie, body: { kind: 'viewing', source: 'walkin', name: 'Цэцэг', phone: '95001122', note: 'Оффис дээр ирсэн' } });
    expect(r.status).toBe(200);
    const lead = (await call('GET', `/api/leads/${r.data.id}`, { cookie: salesCookie })).data.lead;
    expect(lead.assigned_name).toBe('Сараа');
    expect(lead.source).toBe('walkin');
  });
});

describe('flats, prices and the showroom copy', () => {
  const id = '804B-20-347';
  const formula = () => getUnit('804B', 20, 347)!.listPrice;

  it('sells, discounts and reprices in bulk, and the showroom sees it', async () => {
    const before = await call('GET', '/api/public/inventory', { admin: false });
    const etag = before.res.headers.get('etag')!;
    expect((await call('GET', '/api/public/inventory', { admin: false, headers: { 'if-none-match': etag } })).status).toBe(304);

    const ids = ['804B-20-341', '804B-20-343', '804B-20-345', id];
    expect((await call('PATCH', '/api/units', { cookie: adminCookie, body: { ids, set: { status: 'available' } } })).status).toBe(200);
    const sale = await call('PATCH', '/api/units', { cookie: adminCookie, body: { ids, set: { discountPct: 10, saleUntil: '2099-01-01' } } });
    expect(sale.data.changed).toHaveLength(4);

    const snap = (await call('GET', '/api/public/inventory', { admin: false })).data as InventorySnapshot;
    expect(snap.units[id].s).toBe('available');
    expect(snap.units[id].l).toBe(formula());
    expect(snap.units[id].p).toBe(Math.round((formula() * 0.9) / 1000) * 1000);
    expect(Object.keys(snap.units)).toHaveLength(552);
    expect(Object.keys(snap.bays)).toHaveLength(272);

    // A sale that ended no longer lowers the price.
    await call('PATCH', '/api/units', { cookie: adminCookie, body: { ids: [id], set: { saleUntil: '2020-01-01' } } });
    expect(((await call('GET', '/api/public/inventory', { admin: false })).data as InventorySnapshot).units[id].p).toBe(formula());

    expect((await call('PATCH', '/api/units', { cookie: adminCookie, body: { ids: [id], set: { salePrice: formula() + 1_000_000 } } })).data.error).toBe('sale_not_lower');

    await call('PATCH', '/api/units', { cookie: adminCookie, body: { ids: [id], set: { clearSale: true, listPriceChangePct: 5 } } });
    const unit = (await call('GET', `/api/units/${id}`, { cookie: salesCookie })).data;
    expect(unit.unit.listPrice).toBe(Math.round((formula() * 1.05) / 1000) * 1000);
    expect(unit.unit.customListPrice).toBe(true);
    expect(unit.history.map((h: { field: string }) => h.field)).toEqual(expect.arrayContaining(['list_price', 'price']));

    await call('PATCH', '/api/units', { cookie: adminCookie, body: { ids: [id], set: { listPrice: null } } });
    expect((await call('GET', `/api/units/${id}`, { cookie: salesCookie })).data.unit.customListPrice).toBe(false);
  });

  it('reprices every formula flat when the base price changes', async () => {
    const pricing = (await call('GET', '/api/settings/pricing', { cookie: salesCookie })).data;
    expect((await call('PATCH', '/api/settings/pricing', { cookie: adminCookie, body: { pricePerM2: 5_000_000 } })).status).toBe(403);
    await call('PATCH', '/api/settings/pricing', { cookie: superCookie, body: { pricePerM2: pricing.pricePerM2 * 2 } });
    const snap = (await call('GET', '/api/public/inventory', { admin: false })).data as InventorySnapshot;
    expect(snap.units[id].l).toBe(formula() * 2);
    await call('PATCH', '/api/settings/pricing', { cookie: superCookie, body: { pricePerM2: pricing.pricePerM2 } });
  });

  it('notes on the lead when its flat is reserved', async () => {
    const lead = (await call('POST', '/api/leads', { cookie: adminCookie, body: { kind: 'viewing', source: 'phone', name: 'Ганаа', phone: '99887766', unitId: id } })).data.id;
    await call('PATCH', '/api/units', { cookie: adminCookie, body: { ids: [id], set: { status: 'reserved', leadId: lead, reservedUntil: '2026-11-20' } } });
    const detail = (await call('GET', `/api/leads/${lead}`, { cookie: adminCookie })).data;
    expect(detail.activity.some((a: { kind: string; body: string }) => a.kind === 'inventory' && a.body === `${id}:reserved`)).toBe(true);
    const u = (await call('GET', `/api/units/${id}`, { cookie: adminCookie })).data.unit;
    expect(u.reservedUntil).toBe('2026-11-20');
    // Back to available clears the reservation date.
    await call('PATCH', '/api/units', { cookie: adminCookie, body: { ids: [id], set: { status: 'available' } } });
    expect((await call('GET', `/api/units/${id}`, { cookie: adminCookie })).data.unit.reservedUntil).toBeNull();
  });
});

describe('analytics', () => {
  it('counts floors with their flats, visitors once a day, and the funnel', async () => {
    const session = 'test-session-0001';
    const events = [
      { type: 'view', view: 'overview' },
      { type: 'view', view: 'block', block: '804A' },
      { type: 'view', view: 'floor', block: '804A', storey: 12 },
      { type: 'view', view: 'unit', block: '804A', storey: 12, stack: 325 },
      { type: 'view', view: 'unit', block: '804A', storey: 12, stack: 325, spot: 'living-1' },
      { type: 'view', view: 'unit', block: '804A', storey: 12, stack: 999 },
      { type: 'view', view: 'floor', block: 'NOPE', storey: 3 },
      { type: 'action', action: 'lead_open', kind: 'viewing', block: '804A', storey: 12, stack: 325 },
    ];
    const r = await call('POST', '/api/public/events', { admin: false, body: { session, device: 'mobile', events } });
    expect(r.data.kept).toBe(6);
    await call('POST', '/api/public/events', { admin: false, body: { session, device: 'mobile', events: [{ type: 'view', view: 'unit', block: '804A', storey: 12, stack: 325 }] } });
    await call('POST', '/api/public/events', { admin: false, body: { session: 'test-session-0002', device: 'desktop', events: [{ type: 'view', view: 'floor', block: '804A', storey: 12 }] } });

    const a = (await call('GET', '/api/analytics?days=7', { cookie: salesCookie })).data;
    expect(a.totals.visitors).toBe(2);
    const floor = a.floors.find((f: { block: string; storey: number }) => f.block === '804A' && f.storey === 12);
    expect(floor.views).toBe(4);
    expect(floor.visitors).toBe(2);
    const unit = a.topUnits.find((u: { key: string }) => u.key === '804A-12-325');
    expect(unit.views).toBe(2);
    expect(unit.visitors).toBe(1);
    expect(a.byRoom[0].key).toBe('living');
    expect(a.funnel).toMatchObject({ visitors: 2, block: 2, floor: 2, unit: 1, leadOpen: 1 });
    expect(a.devices).toEqual(expect.arrayContaining([{ key: 'mobile', visits: 1 }]));

    const interest = (await call('GET', '/api/units', { cookie: salesCookie })).data.interest;
    expect(interest['804A-12-325']).toEqual({ views: 2, visitors: 1 });
  });

  it('shows the path a buyer took on their lead', async () => {
    const session = 'test-session-0003';
    await call('POST', '/api/public/events', { admin: false, body: { session, device: 'desktop', events: [{ type: 'view', view: 'unit', block: '804B', storey: 5, stack: 349 }] } });
    const id = (await call('POST', '/api/public/leads', { admin: false, ip: '7.7.7.7', body: { kind: 'info', source: 'showroom', name: 'Нараа', phone: '99001100', question: 'Урьдчилгаа?', session } })).data.id;
    const detail = (await call('GET', `/api/leads/${id}`, { cookie: salesCookie })).data;
    expect(detail.journey.path).toEqual(['u:804B-5-349']);
  });

  it('rejects a malformed batch', async () => {
    expect((await call('POST', '/api/public/events', { admin: false, body: { session: 'x', events: [] } })).status).toBe(400);
    expect((await call('POST', '/api/public/events', { admin: false, body: { session: 'test-session-0004', events: Array(60).fill({ type: 'view', view: 'overview' }) } })).status).toBe(400);
  });
});

describe('dashboard and exports', () => {
  it('summarises flats, leads and visitors', async () => {
    const d = (await call('GET', '/api/dashboard', { cookie: salesCookie })).data;
    expect(d.units.total).toBe(552);
    expect(d.units.available + d.units.reserved + d.units.sold).toBe(552);
    expect(d.units.byBlock).toHaveLength(2);
    expect(d.leads.total).toBeGreaterThan(5);
    expect(d.days).toHaveLength(30);
    expect(d.visitors.last7).toBeGreaterThanOrEqual(3);
  });

  it('records exports in the audit log, for admins only', async () => {
    const body = { what: 'leads', format: 'xlsx', rows: 12, filter: { status: 'new' } };
    expect((await call('POST', '/api/audit/export', { cookie: salesCookie, body })).status).toBe(403);
    expect((await call('POST', '/api/audit/export', { cookie: adminCookie, body })).status).toBe(200);
    const audit = (await call('GET', '/api/audit', { cookie: superCookie })).data.entries;
    const entry = audit.find((e: { action: string }) => e.action === 'export');
    expect(entry.target).toBe('leads');
    expect(JSON.parse(entry.detail)).toMatchObject({ format: 'xlsx', rows: 12 });
  });
});

describe('upkeep', () => {
  it('clears expired sessions and rebuilds the showroom copy', async () => {
    await db.run("INSERT INTO throttle (key, hits, reset_at) VALUES ('old', 1, '2000-01-01T00:00:00.000Z')");
    await app.maintain();
    expect(await db.get("SELECT 1 AS x FROM throttle WHERE key = 'old'")).toBeUndefined();
    expect((await call('GET', '/api/public/inventory', { admin: false })).status).toBe(200);
  });
});
