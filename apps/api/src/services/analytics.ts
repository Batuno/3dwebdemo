// Showroom analytics as daily counters (table view_counts) plus one row per visit (table visits).
// A batch of events costs two rows read and a handful written; a 30-day report reads one row per counter
// per day. That keeps a busy showroom inside D1's free plan, and a daily write budget makes sure analytics
// can never use up the writes that leads need.
import {
  ACTION_KINDS,
  blockById,
  getUnit,
  interiors,
  LEAD_KINDS,
  outdoorSpotById,
  VIEW_KINDS,
  type Device,
  type TrackEvent,
} from '@bair/project-data';
import { badRequest, obj } from '../http';
import { addDays, dayStartIso, localDay, localHour } from '../lib/time';
import type { SqlDb } from '../db';
import { SESSION_RE } from './leads';

const DEVICES: readonly Device[] = ['mobile', 'tablet', 'desktop'];
export const MAX_BATCH = 50;
/** Rows analytics may write per day. D1's free plan allows 100,000; the rest is kept for leads and the admin. */
export const ANALYTICS_WRITES_PER_DAY = 60_000;
/** Events one visit may record per day; beyond that it is a script, not a buyer. */
export const EVENTS_PER_VISIT = 1500;
const PATH_MAX = 60;
const SEEN_MAX = 400;

/** How far into the project a visit went: block 1, floor 2, flat 3, lead form 4. */
const DEPTH: Record<string, number> = { overview: 0, garage: 0, outdoor: 0, block: 1, floor: 2, unit: 3, room: 3 };

interface CleanEvent {
  type: 'view' | 'action';
  view: string | null;
  action: string | null;
  block: string | null;
  storey: number | null;
  unitId: string | null;
  unitType: string | null;
  room: string | null;
  spot: string | null;
}

/**
 * Checks one event against the project data and fills in the unit, its type and the room. Returns null for
 * anything that does not describe a real place, so a bad client cannot fill the tables with junk.
 */
export function cleanEvent(e: TrackEvent): CleanEvent | null {
  if (e.type !== 'view' && e.type !== 'action') return null;
  if (e.type === 'view' && !VIEW_KINDS.includes(e.view!)) return null;
  if (e.type === 'action' && !ACTION_KINDS.includes(e.action!)) return null;
  const out: CleanEvent = {
    type: e.type,
    view: e.type === 'view' ? e.view! : null,
    action: e.type === 'action' ? e.action! : null,
    block: null,
    storey: null,
    unitId: null,
    unitType: null,
    room: null,
    spot: null,
  };
  if (out.action === 'lead_open' && e.kind && LEAD_KINDS.includes(e.kind)) out.spot = e.kind;

  if (out.view === 'outdoor') {
    if (typeof e.spot !== 'string' || !outdoorSpotById(e.spot)) return null;
    out.spot = e.spot;
    return out;
  }
  if (typeof e.block === 'string') {
    const b = blockById(e.block);
    if (!b) return null;
    out.block = b.id;
    if (e.storey !== undefined) {
      if (!Number.isInteger(e.storey) || e.storey! < 2 || e.storey! > b.storeys) return null;
      out.storey = e.storey!;
      if (e.stack !== undefined) {
        const unit = getUnit(b.id, out.storey, Number(e.stack));
        if (!unit) return null;
        out.unitId = unit.id;
        out.unitType = unit.type;
        if (typeof e.spot === 'string' && out.type === 'view') {
          const hotspot = interiors[unit.type].hotspots.find((h) => h.id === e.spot);
          if (!hotspot) return null;
          out.spot = hotspot.id;
          out.room = hotspot.room;
          if (out.view === 'unit') out.view = 'room';
        }
      }
    }
  }
  // A view must carry the place it names.
  if (out.view === 'block' && !out.block) return null;
  if (out.view === 'floor' && out.storey === null) return null;
  if ((out.view === 'unit' || out.view === 'room') && !out.unitId) return null;
  return out;
}

/**
 * The counters one event moves. Views go up by the given amount; every key except hours and totals also
 * counts the visit once a day as a visitor. A floor's views include views of its flats, a block's all views
 * inside it, so the floor heat map shows interest in the floor and what is on it.
 */
function touches(e: CleanEvent, hour: number): [string, number][] {
  const out: [string, number][] = [];
  if (e.type === 'action') {
    out.push([`a:${e.action}`, 1]);
    if (e.unitId) out.push([`u:${e.unitId}`, 0]);
    return out;
  }
  out.push([`v:${e.view}`, 1], [`h:${hour}`, 1]);
  if (e.view === 'outdoor') out.push([`o:${e.spot}`, 1]);
  if (e.block) out.push([`b:${e.block}`, 1]);
  if (e.storey !== null) out.push([`f:${e.block}:${e.storey}`, e.view === 'room' ? 0 : 1]);
  if (e.unitId) out.push([`u:${e.unitId}`, e.view === 'unit' ? 1 : 0], [`t:${e.unitType}`, e.view === 'unit' ? 1 : 0]);
  if (e.room) out.push([`r:${e.room}`, 1]);
  return out;
}

const pathKey = (e: CleanEvent): string | null => {
  if (e.type === 'action') return `a:${e.action}`;
  if (e.view === 'room') return `r:${e.unitId}:${e.spot}`;
  if (e.view === 'unit') return `u:${e.unitId}`;
  if (e.view === 'floor') return `f:${e.block}:${e.storey}`;
  if (e.view === 'block') return `b:${e.block}`;
  if (e.view === 'outdoor') return `o:${e.spot}`;
  return `v:${e.view}`;
};

interface VisitRow {
  depth: number | null;
  events: number | null;
  seen: string | null;
  path: string | null;
  device: string | null;
  first_at: string | null;
  writes: number | null;
}

/** Stores a batch from the showroom. Returns how many events were kept (0 when over a budget). */
export async function ingest(db: SqlDb, body: unknown, now: Date = new Date()): Promise<number> {
  const b = obj(body);
  if (typeof b.session !== 'string' || !SESSION_RE.test(b.session)) throw badRequest('invalid', 'session');
  const session = b.session;
  const device = DEVICES.includes(b.device as Device) ? (b.device as Device) : 'desktop';
  if (!Array.isArray(b.events) || b.events.length > MAX_BATCH) throw badRequest('invalid', 'events');
  const clean = b.events.map((e) => (typeof e === 'object' && e ? cleanEvent(e as TrackEvent) : null)).filter((e): e is CleanEvent => !!e);
  if (!clean.length) return 0;

  const day = localDay(now);
  const hour = localHour(now);
  const visit = (await db.get<VisitRow>(
    `SELECT v.depth, v.events, v.seen, v.path, v.device, v.first_at,
       (SELECT views FROM view_counts WHERE day = ? AND key = 'x:writes') AS writes
     FROM (SELECT 1) AS one LEFT JOIN visits v ON v.day = ? AND v.session = ?`,
    day,
    day,
    session,
  ))!;
  const isNew = visit.depth === null;
  if ((visit.events ?? 0) + clean.length > EVENTS_PER_VISIT) return 0;

  const seen = new Set<string>(isNew ? [] : (JSON.parse(visit.seen!) as string[]));
  const path: string[] = isNew ? [] : (JSON.parse(visit.path!) as string[]);
  const counts = new Map<string, [number, number]>();
  const bump = (key: string, views: number, visitor: boolean) => {
    const c = counts.get(key) ?? [0, 0];
    c[0] += views;
    if (visitor && !seen.has(key) && seen.size < SEEN_MAX) {
      seen.add(key);
      c[1] += 1;
    }
    counts.set(key, c);
  };

  let depth = visit.depth ?? 0;
  const before = depth;
  for (const e of clean) {
    for (const [key, views] of touches(e, hour)) bump(key, views, !key.startsWith('h:'));
    depth = Math.max(depth, e.type === 'action' ? (e.action === 'lead_open' ? 4 : 0) : (DEPTH[e.view!] ?? 0));
    const k = pathKey(e);
    if (k && path[path.length - 1] !== k) path.push(k);
  }
  if (isNew) {
    bump('x:visits', 1, false);
    bump(`d:${device}`, 1, false);
    bump('k:0', 1, false);
  }
  for (let d = before + 1; d <= depth; d++) bump(`k:${d}`, 1, false);
  bump('x:events', clean.length, false);

  // Each counter row and the visit row is one row written; the x:writes counter is one of the counters.
  const writes = counts.size + 2;
  if ((visit.writes ?? 0) + writes > ANALYTICS_WRITES_PER_DAY) return 0;
  bump('x:writes', writes, false);

  const ts = now.toISOString();
  await db.batch([
    {
      sql: `INSERT INTO visits (day, session, device, depth, events, first_at, last_at, seen, path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(day, session) DO UPDATE SET depth = excluded.depth, events = excluded.events, last_at = excluded.last_at,
              seen = excluded.seen, path = excluded.path`,
      params: [day, session, visit.device ?? device, depth, (visit.events ?? 0) + clean.length, visit.first_at ?? ts, ts, JSON.stringify([...seen]), JSON.stringify(path.slice(-PATH_MAX))],
    },
    {
      sql: `INSERT INTO view_counts (day, key, views, visitors)
            SELECT ?, j.value ->> '$[0]', j.value ->> '$[1]', j.value ->> '$[2]' FROM json_each(?) AS j WHERE true
            ON CONFLICT(day, key) DO UPDATE SET views = view_counts.views + excluded.views, visitors = view_counts.visitors + excluded.visitors`,
      params: [day, JSON.stringify([...counts].map(([k, [v, s]]) => [k, v, s]))],
    },
  ]);
  return clean.length;
}

/* ---------- Reports ---------- */

export interface Range {
  from: string;
  to: string;
}

/** The last `days` days up to today; `days` 0 means since the first day anything was recorded. */
export async function rangeFor(db: SqlDb, days: number): Promise<Range> {
  const to = localDay();
  if (days > 0) return { from: addDays(to, -(days - 1)), to };
  const first = await db.get<{ d: string | null; l: string | null }>('SELECT (SELECT MIN(day) FROM view_counts) AS d, (SELECT MIN(created_at) FROM leads) AS l');
  const candidates = [first?.d, first?.l ? localDay(new Date(first.l)) : null].filter((d): d is string => !!d);
  return { from: candidates.length ? candidates.sort()[0] : to, to };
}

interface CountRow {
  day: string;
  key: string;
  views: number;
  visitors: number;
}

export interface KeyTotal {
  key: string;
  views: number;
  visitors: number;
}

export async function analytics(db: SqlDb, r: Range) {
  const [rows, leadRows] = await Promise.all([
    db.all<CountRow>('SELECT day, key, views, visitors FROM view_counts WHERE day BETWEEN ? AND ?', r.from, r.to),
    db.all<{ created_at: string; source: string }>('SELECT created_at, source FROM leads WHERE created_at >= ? AND created_at < ?', dayStartIso(r.from), dayStartIso(addDays(r.to, 1))),
  ]);

  const totals = new Map<string, KeyTotal>();
  const perDay = new Map<string, { visitors: number; views: number; leads: number }>();
  const dayOf = (d: string) => {
    let x = perDay.get(d);
    if (!x) perDay.set(d, (x = { visitors: 0, views: 0, leads: 0 }));
    return x;
  };
  for (const row of rows) {
    const t = totals.get(row.key) ?? { key: row.key, views: 0, visitors: 0 };
    t.views += row.views;
    t.visitors += row.visitors;
    totals.set(row.key, t);
    if (row.key === 'x:visits') dayOf(row.day).visitors += row.views;
    else if (row.key.startsWith('v:')) dayOf(row.day).views += row.views;
  }
  for (const l of leadRows) dayOf(localDay(new Date(l.created_at))).leads++;

  const byDay = [];
  for (let d = r.from; d <= r.to && byDay.length < 4000; d = addDays(d, 1)) byDay.push({ day: d, ...(perDay.get(d) ?? { visitors: 0, views: 0, leads: 0 }) });

  const group = (prefix: string) =>
    [...totals.values()]
      .filter((t) => t.key.startsWith(prefix))
      .map((t) => ({ ...t, key: t.key.slice(prefix.length) }))
      .sort((a, b) => b.visitors - a.visitors || b.views - a.views);
  const n = (key: string) => totals.get(key)?.views ?? 0;
  const showroomLeads = leadRows.filter((l) => l.source === 'showroom').length;

  return {
    range: r,
    totals: {
      visitors: n('x:visits'),
      views: [...totals.values()].filter((t) => t.key.startsWith('v:')).reduce((s, t) => s + t.views, 0),
      unitViews: n('v:unit'),
      roomViews: n('v:room'),
      leadOpens: n('a:lead_open'),
      leads: leadRows.length,
      showroomLeads,
    },
    byDay,
    views: group('v:'),
    byBlock: group('b:'),
    floors: group('f:').map((f) => {
      const [block, storey] = f.key.split(':');
      return { block, storey: Number(storey), views: f.views, visitors: f.visitors };
    }),
    topUnits: group('u:').slice(0, 25),
    byType: group('t:'),
    byRoom: group('r:'),
    outdoor: group('o:'),
    devices: group('d:').map((d) => ({ key: d.key, visits: d.views })),
    hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, views: n(`h:${h}`) })),
    actions: group('a:'),
    funnel: {
      visitors: n('k:0'),
      block: n('k:1'),
      floor: n('k:2'),
      unit: n('k:3'),
      leadOpen: n('k:4'),
      lead: showroomLeads,
    },
  };
}

export type Analytics = Awaited<ReturnType<typeof analytics>>;

/** Views and visitors per flat over a range, for the flat grid's interest colouring. */
export async function unitInterest(db: SqlDb, r: Range): Promise<Record<string, { views: number; visitors: number }>> {
  const rows = await db.all<{ key: string; views: number; visitors: number }>(
    "SELECT key, SUM(views) AS views, SUM(visitors) AS visitors FROM view_counts WHERE day BETWEEN ? AND ? AND key >= 'u:' AND key < 'u;' GROUP BY key",
    r.from,
    r.to,
  );
  return Object.fromEntries(rows.map((x) => [x.key.slice(2), { views: x.views, visitors: x.visitors }]));
}

/** Keeps the tables small: visit rows (only needed to show a lead's path) go after `keepDays`. */
export async function pruneVisits(db: SqlDb, keepDays: number) {
  await db.run('DELETE FROM visits WHERE day < ?', addDays(localDay(), -keepDays));
}

