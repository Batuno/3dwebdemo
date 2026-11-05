import {
  allUnits,
  garageBays,
  isValidMongolianPhone,
  LEAD_KINDS,
  LEAD_SOURCES,
  LEAD_STATUSES,
  normalizePhone,
  type LeadKind,
  type LeadSource,
  type LeadStatus,
} from '@bair/project-data';
import { badRequest, date, int, oneOf, str, TIME_RE } from '../http';
import { addDays, dayStartIso, localDay } from '../lib/time';
import type { SqlDb, Statement } from '../db';
import { nowIso } from '../db';

const unitIds = new Set(allUnits.map((u) => u.id));
const bayIds = new Set(garageBays.map((b) => b.id));
export const SESSION_RE = /^[A-Za-z0-9_-]{8,64}$/;

export interface LeadRow {
  id: number;
  kind: LeadKind;
  source: LeadSource;
  name: string;
  phone: string;
  unit_id: string | null;
  parking_bay: string | null;
  viewing_date: string | null;
  viewing_time: string | null;
  question: string | null;
  status: LeadStatus;
  assigned_to: number | null;
  assigned_name: string | null;
  next_action_at: string | null;
  session: string | null;
  created_at: string;
  updated_at: string;
  /** Other leads with the same phone number. */
  duplicates: number;
}

export interface LeadInput {
  kind: LeadKind;
  source: LeadSource;
  name: string;
  phone: string;
  unitId?: string;
  parkingBay?: string;
  date?: string;
  time?: string;
  question?: string;
  session?: string;
  status?: LeadStatus;
  assignedTo?: number | null;
  nextActionAt?: string | null;
}

/** Validates a lead from a public form or the admin panel. Throws a 400 on anything off. */
export function parseLeadInput(v: Record<string, unknown>, sources: readonly LeadSource[]): LeadInput {
  const phoneRaw = str(v.phone, 'phone', { max: 30 })!;
  if (!isValidMongolianPhone(phoneRaw)) throw badRequest('invalid_phone');
  const unitId = str(v.unitId, 'unitId', { max: 30, optional: true });
  if (unitId && !unitIds.has(unitId)) throw badRequest('unknown_unit');
  const parkingBay = str(v.parkingBay, 'parkingBay', { max: 20, optional: true });
  if (parkingBay && !bayIds.has(parkingBay)) throw badRequest('unknown_bay');
  const time = str(v.time, 'time', { max: 5, optional: true });
  if (time && !TIME_RE.test(time)) throw badRequest('invalid', 'time must be HH:MM');
  const session = str(v.session, 'session', { max: 64, optional: true });
  return {
    kind: oneOf(v.kind, 'kind', LEAD_KINDS)!,
    source: oneOf(v.source, 'source', sources)!,
    name: str(v.name, 'name', { min: 1, max: 80 })!,
    phone: normalizePhone(phoneRaw),
    unitId,
    parkingBay,
    date: date(v.date, 'date'),
    time,
    question: str(v.question, 'question', { max: 1000, optional: true }),
    session: session && SESSION_RE.test(session) ? session : undefined,
  };
}

export async function createLead(db: SqlDb, l: LeadInput): Promise<number> {
  const now = nowIso();
  const row = await db.get<{ id: number }>(
    `INSERT INTO leads (kind, source, name, phone, unit_id, parking_bay, viewing_date, viewing_time, question, status, assigned_to, next_action_at, session, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    l.kind,
    l.source,
    l.name,
    l.phone,
    l.unitId ?? null,
    l.parkingBay ?? null,
    l.date ?? null,
    l.time ?? null,
    l.question ?? null,
    l.status ?? 'new',
    l.assignedTo ?? null,
    l.nextActionAt ?? null,
    l.session ?? null,
    now,
    now,
  );
  return row!.id;
}

export const activityStatement = (leadId: number, userId: number | null, kind: string, body: string): Statement => ({
  sql: 'INSERT INTO lead_activity (lead_id, user_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)',
  params: [leadId, userId, kind, body.slice(0, 2000), nowIso()],
});

export interface LeadFilter {
  status?: LeadStatus;
  source?: LeadSource;
  kind?: LeadKind;
  /** A user id, or "none" for unassigned. */
  assigned?: number | 'none';
  q?: string;
  unit?: string;
  /** YYYY-MM-DD, inclusive, in the report time zone. */
  from?: string;
  to?: string;
  /** Follow-ups due on or before this day. */
  dueBy?: string;
}

export function parseLeadFilter(q: URLSearchParams): LeadFilter {
  const assigned = q.get('assigned');
  return {
    status: oneOf(q.get('status'), 'status', LEAD_STATUSES, true),
    source: oneOf(q.get('source'), 'source', LEAD_SOURCES, true),
    kind: oneOf(q.get('kind'), 'kind', LEAD_KINDS, true),
    assigned: assigned === 'none' ? 'none' : int(assigned, 'assigned', { min: 1, optional: true }),
    q: str(q.get('q'), 'q', { max: 80, optional: true }),
    unit: str(q.get('unit'), 'unit', { max: 30, optional: true }),
    from: date(q.get('from'), 'from'),
    to: date(q.get('to'), 'to'),
    dueBy: date(q.get('dueBy'), 'dueBy'),
  };
}

const LEAD_SELECT = `SELECT l.*, u.name AS assigned_name,
    (SELECT COUNT(*) FROM leads d WHERE d.phone = l.phone AND d.id != l.id) AS duplicates
  FROM leads l LEFT JOIN users u ON u.id = l.assigned_to`;

export async function listLeads(db: SqlDb, f: LeadFilter = {}): Promise<LeadRow[]> {
  const where: string[] = [];
  const args: (string | number)[] = [];
  const add = (sql: string, ...a: (string | number)[]) => {
    where.push(sql);
    args.push(...a);
  };
  if (f.status) add('l.status = ?', f.status);
  if (f.source) add('l.source = ?', f.source);
  if (f.kind) add('l.kind = ?', f.kind);
  if (f.assigned === 'none') add('l.assigned_to IS NULL');
  else if (f.assigned) add('l.assigned_to = ?', f.assigned);
  if (f.unit) add('l.unit_id = ?', f.unit);
  if (f.from) add('l.created_at >= ?', dayStartIso(f.from));
  if (f.to) add('l.created_at < ?', dayStartIso(addDays(f.to, 1)));
  if (f.dueBy) add("l.next_action_at IS NOT NULL AND l.next_action_at <= ? AND l.status NOT IN ('order', 'lost')", f.dueBy);
  const list = await db.all<LeadRow>(`${LEAD_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.created_at DESC, l.id DESC LIMIT 5000`, ...args);
  if (!f.q) return list;
  // Searched here rather than in SQL: SQLite folds only ASCII case, and the names are mostly Cyrillic.
  const q = f.q.toLowerCase();
  const digits = f.q.replace(/\D/g, '');
  return list.filter(
    (l) =>
      l.name.toLowerCase().includes(q) ||
      (l.unit_id ?? '').toLowerCase().includes(q) ||
      (l.question ?? '').toLowerCase().includes(q) ||
      (digits.length >= 3 && l.phone.includes(digits)),
  );
}

export function getLead(db: SqlDb, id: number): Promise<LeadRow | undefined> {
  return db.get<LeadRow>(`${LEAD_SELECT} WHERE l.id = ?`, id);
}

export function leadActivity(db: SqlDb, id: number) {
  return db.all(
    `SELECT a.id, a.kind, a.body, a.created_at AS createdAt, u.name AS user
     FROM lead_activity a LEFT JOIN users u ON u.id = a.user_id WHERE a.lead_id = ? ORDER BY a.id DESC LIMIT 200`,
    id,
  );
}

/** What the buyer looked at in the showroom on the day they left their number and the two days before. */
export async function leadJourney(db: SqlDb, lead: LeadRow): Promise<{ path: string[]; device: string | null }> {
  if (!lead.session) return { path: [], device: null };
  const day = localDay(new Date(lead.created_at));
  const rows = await db.all<{ day: string; path: string; device: string }>(
    'SELECT day, path, device FROM visits WHERE day IN (?, ?, ?) AND session = ? ORDER BY day',
    addDays(day, -2),
    addDays(day, -1),
    day,
    lead.session,
  );
  return { path: rows.flatMap((r) => JSON.parse(r.path) as string[]), device: rows[0]?.device ?? null };
}

/** Other leads from the same phone number, so a returning buyer is recognised. */
export function samePhone(db: SqlDb, lead: LeadRow) {
  return db.all(
    'SELECT id, name, unit_id AS unitId, status, created_at AS createdAt FROM leads WHERE phone = ? AND id != ? ORDER BY created_at DESC LIMIT 20',
    lead.phone,
    lead.id,
  );
}

export interface LeadPatch {
  status?: LeadStatus;
  assignedTo?: number | null;
  nextActionAt?: string | null;
  name?: string;
  phone?: string;
  unitId?: string | null;
}

export function parseLeadPatch(v: Record<string, unknown>): LeadPatch {
  const p: LeadPatch = {};
  if ('status' in v) p.status = oneOf(v.status, 'status', LEAD_STATUSES);
  if ('assignedTo' in v) p.assignedTo = v.assignedTo === null ? null : int(v.assignedTo, 'assignedTo', { min: 1 });
  if ('nextActionAt' in v) p.nextActionAt = v.nextActionAt === null ? null : (date(v.nextActionAt, 'nextActionAt', false) ?? null);
  if ('name' in v) p.name = str(v.name, 'name', { min: 1, max: 80 });
  if ('phone' in v) {
    const raw = str(v.phone, 'phone', { max: 30 })!;
    if (!isValidMongolianPhone(raw)) throw badRequest('invalid_phone');
    p.phone = normalizePhone(raw);
  }
  if ('unitId' in v) {
    const u = v.unitId === null || v.unitId === '' ? null : str(v.unitId, 'unitId', { max: 30 })!;
    if (u && !unitIds.has(u)) throw badRequest('unknown_unit');
    p.unitId = u;
  }
  if (!Object.keys(p).length) throw badRequest('invalid', 'Nothing to change');
  return p;
}

/** The statements for a change: the update and a timeline entry per field that changed. */
export async function planLeadUpdate(db: SqlDb, before: LeadRow, p: LeadPatch, userId: number): Promise<{ fields: string[]; statements: Statement[] }> {
  let assigneeName = '';
  if (p.assignedTo != null && p.assignedTo !== before.assigned_to) {
    const u = await db.get<{ name: string }>('SELECT name FROM users WHERE id = ? AND active = 1', p.assignedTo);
    if (!u) throw badRequest('unknown_user');
    assigneeName = u.name;
  }
  const cols: Record<string, string | number | null> = {};
  if (p.status !== undefined && p.status !== before.status) cols.status = p.status;
  if (p.assignedTo !== undefined && p.assignedTo !== before.assigned_to) cols.assigned_to = p.assignedTo;
  if (p.nextActionAt !== undefined && p.nextActionAt !== before.next_action_at) cols.next_action_at = p.nextActionAt;
  if (p.name !== undefined && p.name !== before.name) cols.name = p.name;
  if (p.phone !== undefined && p.phone !== before.phone) cols.phone = p.phone;
  if (p.unitId !== undefined && p.unitId !== before.unit_id) cols.unit_id = p.unitId;
  const keys = Object.keys(cols);
  if (!keys.length) return { fields: [], statements: [] };
  const id = before.id;
  const statements: Statement[] = [
    { sql: `UPDATE leads SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, params: [...keys.map((k) => cols[k]), nowIso(), id] },
  ];
  if ('status' in cols) statements.push(activityStatement(id, userId, 'status', `${before.status}→${cols.status}`));
  if ('assigned_to' in cols) statements.push(activityStatement(id, userId, 'assign', assigneeName));
  if ('next_action_at' in cols) statements.push(activityStatement(id, userId, 'next_action', String(cols.next_action_at ?? '')));
  if ('unit_id' in cols) statements.push(activityStatement(id, userId, 'unit', String(cols.unit_id ?? '')));
  if ('name' in cols || 'phone' in cols) statements.push(activityStatement(id, userId, 'edit', [cols.name, cols.phone].filter(Boolean).join(' · ')));
  return { fields: keys, statements };
}
