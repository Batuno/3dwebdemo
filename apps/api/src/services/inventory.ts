// Flats and parking bays as the sales team sees them: the generated project data with the database's changes on top.
import { allUnits, garageBays, unitPrice, type InventorySnapshot, type UnitStatus, type UnitTypeId } from '@bair/project-data';
import { badRequest, date, int, num, oneOf, str } from '../http';
import { localDay } from '../lib/time';
import type { SqlDb, Statement } from '../db';
import { nowIso } from '../db';
import { sha256 } from '../auth';
import { getPricing, type PricingSettings } from './settings';

export const UNIT_STATUSES: readonly UnitStatus[] = ['available', 'reserved', 'sold'];

interface Row {
  id: string;
  kind: 'unit' | 'bay';
  status: UnitStatus | null;
  list_price: number | null;
  discount_pct: number | null;
  sale_price: number | null;
  sale_until: string | null;
  reserved_until: string | null;
  lead_id: number | null;
  note: string | null;
  updated_at: string;
  updated_by: number | null;
  updated_by_name?: string | null;
}

export interface ItemView {
  id: string;
  kind: 'unit' | 'bay';
  status: UnitStatus;
  /** Price before any sale: the formula, or the list price someone set. */
  listPrice: number;
  /** What the buyer pays today. */
  price: number;
  /** A sale is set and has not ended. */
  onSale: boolean;
  discountPct: number | null;
  salePrice: number | null;
  saleUntil: string | null;
  /** Someone set the list price by hand instead of the formula. */
  customListPrice: boolean;
  reservedUntil: string | null;
  leadId: number | null;
  note: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface UnitView extends ItemView {
  block: string;
  storey: number;
  stack: number;
  type: UnitTypeId;
  totalArea: number;
}

export interface BayView extends ItemView {
  number: number;
  row: number;
  column: number;
}

/** Prices round to whole thousands of tögrög. */
const round1000 = (v: number) => Math.round(v / 1000) * 1000;

// The API never lays live state over project data, so these still hold the generated (seeded) statuses.
const unitDefault = new Map(allUnits.map((u) => [u.id, u]));
const bayDefault = new Map(garageBays.map((b) => [b.id, b]));
export const isUnitId = (id: string) => unitDefault.has(id);

async function rows(db: SqlDb, kind: 'unit' | 'bay'): Promise<Map<string, Row>> {
  const list = await db.all<Row>('SELECT i.*, u.name AS updated_by_name FROM inventory i LEFT JOIN users u ON u.id = i.updated_by WHERE i.kind = ?', kind);
  return new Map(list.map((r) => [r.id, r]));
}

function effective(id: string, kind: 'unit' | 'bay', r: Row | undefined, defaultStatus: UnitStatus, formulaPrice: number, today: string): ItemView {
  const listPrice = r?.list_price ?? formulaPrice;
  const hasSale = !!r && (r.sale_price != null || (r.discount_pct ?? 0) > 0);
  const onSale = hasSale && (!r!.sale_until || today <= r!.sale_until);
  const salePrice = r?.sale_price ?? (r?.discount_pct ? round1000(listPrice * (1 - r.discount_pct / 100)) : null);
  return {
    id,
    kind,
    status: r?.status ?? defaultStatus,
    listPrice,
    price: onSale && salePrice != null ? Math.min(salePrice, listPrice) : listPrice,
    onSale,
    discountPct: r?.discount_pct ?? null,
    salePrice: r?.sale_price ?? null,
    saleUntil: r?.sale_until ?? null,
    customListPrice: r?.list_price != null,
    reservedUntil: r?.reserved_until ?? null,
    leadId: r?.lead_id ?? null,
    note: r?.note ?? null,
    updatedAt: r?.updated_at ?? null,
    updatedBy: r?.updated_by_name ?? null,
  };
}

export async function listUnits(db: SqlDb, pricing?: PricingSettings): Promise<UnitView[]> {
  const [map, p] = await Promise.all([rows(db, 'unit'), pricing ?? getPricing(db)]);
  const today = localDay();
  return allUnits.map((u) => ({
    ...effective(u.id, 'unit', map.get(u.id), u.status, unitPrice(u.totalArea, u.storey, p), today),
    block: u.block,
    storey: u.storey,
    stack: u.stack,
    type: u.type,
    totalArea: u.totalArea,
  }));
}

export async function listBays(db: SqlDb, pricing?: PricingSettings): Promise<BayView[]> {
  const [map, p] = await Promise.all([rows(db, 'bay'), pricing ?? getPricing(db)]);
  const today = localDay();
  return garageBays.map((b) => ({
    ...effective(b.id, 'bay', map.get(b.id), b.status, p.bayPrice, today),
    number: b.number,
    row: b.row,
    column: b.column,
  }));
}

/* ---------- The showroom's copy ---------- */

/**
 * Every showroom visitor loads this, so it is kept ready in one row (rebuilt after a change and once a day,
 * when sales may have ended) and in memory for a few seconds: one row read per visitor at most.
 */
export interface Published {
  etag: string;
  body: string;
}

let memo: { at: number; day: string; value: Published } | null = null;
const MEMO_MS = 15_000;

export function forgetSnapshot() {
  memo = null;
}
export const dropSnapshotStatement: Statement = { sql: "DELETE FROM meta WHERE key = 'snapshot'" };

export async function publishedSnapshot(db: SqlDb): Promise<Published> {
  const today = localDay();
  if (memo && memo.day === today && Date.now() - memo.at < MEMO_MS) return memo.value;
  const row = await db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'snapshot'");
  if (row) {
    const [day, etag] = row.value.slice(0, row.value.indexOf('{')).split('\n');
    if (day === today) {
      const value = { etag, body: row.value.slice(row.value.indexOf('{')) };
      memo = { at: Date.now(), day: today, value };
      return value;
    }
  }
  const pricing = await getPricing(db);
  const [units, bays] = await Promise.all([listUnits(db, pricing), listBays(db, pricing)]);
  const snap: InventorySnapshot = { units: {}, bays: {} };
  for (const u of units) snap.units[u.id] = { s: u.status, p: u.price, l: u.listPrice };
  for (const b of bays) snap.bays[b.id] = { s: b.status, p: b.price, l: b.listPrice };
  const body = JSON.stringify(snap);
  const etag = `"${(await sha256(body)).slice(0, 20)}"`;
  await db.run("INSERT INTO meta (key, value) VALUES ('snapshot', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", `${today}\n${etag}\n${body}`);
  memo = { at: Date.now(), day: today, value: { etag, body } };
  return memo.value;
}

/* ---------- Changes ---------- */

export interface ItemPatch {
  status?: UnitStatus;
  /** A list price in tögrög, or null to go back to the formula. */
  listPrice?: number | null;
  /** Moves the current list price by this many percent (bulk price rises and cuts). */
  listPriceChangePct?: number;
  discountPct?: number | null;
  salePrice?: number | null;
  saleUntil?: string | null;
  /** Ends any sale. */
  clearSale?: boolean;
  reservedUntil?: string | null;
  leadId?: number | null;
  note?: string | null;
}

export function parsePatch(v: Record<string, unknown>): ItemPatch {
  const p: ItemPatch = {};
  if ('status' in v) p.status = oneOf(v.status, 'status', UNIT_STATUSES);
  if ('listPrice' in v) p.listPrice = v.listPrice === null ? null : int(v.listPrice, 'listPrice', { min: 1_000_000, max: 100_000_000_000 });
  if ('listPriceChangePct' in v) p.listPriceChangePct = num(v.listPriceChangePct, 'listPriceChangePct', { min: -50, max: 100 });
  if ('discountPct' in v) p.discountPct = v.discountPct === null ? null : num(v.discountPct, 'discountPct', { min: 0, max: 90 });
  if ('salePrice' in v) p.salePrice = v.salePrice === null ? null : int(v.salePrice, 'salePrice', { min: 1_000_000, max: 100_000_000_000 });
  if ('saleUntil' in v) p.saleUntil = v.saleUntil === null ? null : (date(v.saleUntil, 'saleUntil', false) ?? null);
  if ('clearSale' in v) p.clearSale = v.clearSale === true;
  if ('reservedUntil' in v) p.reservedUntil = v.reservedUntil === null ? null : (date(v.reservedUntil, 'reservedUntil', false) ?? null);
  if ('leadId' in v) p.leadId = v.leadId === null ? null : int(v.leadId, 'leadId', { min: 1 });
  if ('note' in v) p.note = v.note === null ? null : (str(v.note, 'note', { max: 500, optional: true }) ?? null);
  if (!Object.keys(p).length) throw badRequest('invalid', 'Nothing to change');
  return p;
}

export interface ChangeResult {
  changed: string[];
  /** Leads linked to items that just became reserved or sold, for the lead timeline. */
  linked: { leadId: number; itemId: string; status: UnitStatus }[];
  /** Statements to run together with the caller's own (audit, lead timeline). */
  statements: Statement[];
}

/**
 * Works out one patch for many flats or bays. Returns the statements to run (two at most, whatever the
 * number of items) so the caller can add its audit entry and run them as one batch.
 */
export async function planUpdate(db: SqlDb, kind: 'unit' | 'bay', ids: string[], patch: ItemPatch, userId: number): Promise<ChangeResult> {
  const known = kind === 'unit' ? unitDefault : bayDefault;
  const unique = [...new Set(ids)];
  if (!unique.length) throw badRequest('invalid', 'No ids');
  if (unique.length > 2000) throw badRequest('invalid', 'Too many ids');
  for (const id of unique) if (!known.has(id)) throw badRequest('unknown_id', id);
  if (patch.leadId != null && !(await db.get('SELECT 1 AS x FROM leads WHERE id = ?', patch.leadId))) throw badRequest('unknown_lead');

  const pricing = await getPricing(db);
  const [views, current] = await Promise.all([
    (kind === 'unit' ? listUnits(db, pricing) : listBays(db, pricing)).then((l) => new Map((l as ItemView[]).map((v) => [v.id, v]))),
    rows(db, kind),
  ]);
  const now = nowIso();
  const today = localDay();
  const result: ChangeResult = { changed: [], linked: [], statements: [] };
  const upserts: Record<string, string | number | null>[] = [];
  const history: [string, string, string | null, string | null][] = [];

  for (const id of unique) {
    const before = views.get(id)!;
    const r = current.get(id);
    const next = {
      status: r?.status ?? null,
      list_price: r?.list_price ?? null,
      discount_pct: r?.discount_pct ?? null,
      sale_price: r?.sale_price ?? null,
      sale_until: r?.sale_until ?? null,
      reserved_until: r?.reserved_until ?? null,
      lead_id: r?.lead_id ?? null,
      note: r?.note ?? null,
    };
    if (patch.status) {
      next.status = patch.status;
      // An item that is no longer reserved keeps no reservation date.
      if (patch.status !== 'reserved' && !('reservedUntil' in patch)) next.reserved_until = null;
    }
    if (patch.listPrice !== undefined) next.list_price = patch.listPrice;
    if (patch.listPriceChangePct !== undefined) next.list_price = round1000(before.listPrice * (1 + patch.listPriceChangePct / 100));
    if (patch.clearSale) Object.assign(next, { discount_pct: null, sale_price: null, sale_until: null });
    if (patch.discountPct !== undefined) {
      next.discount_pct = patch.discountPct || null;
      next.sale_price = null;
    }
    if (patch.salePrice !== undefined) {
      next.sale_price = patch.salePrice;
      next.discount_pct = null;
    }
    if (patch.saleUntil !== undefined) next.sale_until = patch.saleUntil;
    if (patch.reservedUntil !== undefined) next.reserved_until = patch.reservedUntil;
    if (patch.leadId !== undefined) next.lead_id = patch.leadId;
    if (patch.note !== undefined) next.note = patch.note;

    const d = kind === 'unit' ? unitDefault.get(id)! : null;
    const formula = d && 'totalArea' in d ? unitPrice(d.totalArea, d.storey, pricing) : pricing.bayPrice;
    // A list price equal to the formula is stored as "formula", so later base-price changes still reach it.
    if (next.list_price === formula) next.list_price = null;
    // Where next.status is null, before.status is still the generated one, so it is the right fallback.
    const after = effective(id, kind, { ...next, id, kind, updated_at: now, updated_by: userId }, before.status, formula, today);
    if (next.sale_price != null && next.sale_price >= after.listPrice) throw badRequest('sale_not_lower', id);

    const diffs: [string, string | number | null, string | number | null][] = [];
    if (after.status !== before.status) diffs.push(['status', before.status, after.status]);
    if (after.listPrice !== before.listPrice) diffs.push(['list_price', before.listPrice, after.listPrice]);
    if (after.price !== before.price) diffs.push(['price', before.price, after.price]);
    if (after.reservedUntil !== before.reservedUntil) diffs.push(['reserved_until', before.reservedUntil, after.reservedUntil]);
    if (after.leadId !== before.leadId) diffs.push(['lead', before.leadId, after.leadId]);
    if (after.note !== before.note) diffs.push(['note', before.note, after.note]);
    const saleChanged = after.discountPct !== before.discountPct || after.salePrice !== before.salePrice || after.saleUntil !== before.saleUntil;
    if (!diffs.length && !saleChanged) continue;

    upserts.push({ id, ...next });
    for (const [field, o, n] of diffs) history.push([id, field, o == null ? null : String(o), n == null ? null : String(n)]);
    result.changed.push(id);
    if (after.leadId && after.status !== before.status && after.status !== 'available') {
      result.linked.push({ leadId: after.leadId, itemId: id, status: after.status });
    }
  }

  if (upserts.length) {
    result.statements.push({
      sql: `INSERT INTO inventory (id, kind, status, list_price, discount_pct, sale_price, sale_until, reserved_until, lead_id, note, updated_at, updated_by)
            SELECT j.value ->> '$.id', ?, j.value ->> '$.status', j.value ->> '$.list_price', j.value ->> '$.discount_pct', j.value ->> '$.sale_price',
                   j.value ->> '$.sale_until', j.value ->> '$.reserved_until', j.value ->> '$.lead_id', j.value ->> '$.note', ?, ?
            FROM json_each(?) AS j WHERE true
            ON CONFLICT(id) DO UPDATE SET status = excluded.status, list_price = excluded.list_price, discount_pct = excluded.discount_pct,
              sale_price = excluded.sale_price, sale_until = excluded.sale_until, reserved_until = excluded.reserved_until,
              lead_id = excluded.lead_id, note = excluded.note, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
      params: [kind, now, userId, JSON.stringify(upserts)],
    });
  }
  if (history.length) {
    result.statements.push({
      sql: `INSERT INTO inventory_history (item_id, field, old_value, new_value, user_id, created_at)
            SELECT j.value ->> '$[0]', j.value ->> '$[1]', j.value ->> '$[2]', j.value ->> '$[3]', ?, ? FROM json_each(?) AS j`,
      params: [userId, now, JSON.stringify(history)],
    });
  }
  if (upserts.length) result.statements.push(dropSnapshotStatement);
  return result;
}

export interface HistoryEntry {
  id: number;
  itemId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  user: string | null;
  createdAt: string;
}

export function itemHistory(db: SqlDb, itemId: string, limit = 100): Promise<HistoryEntry[]> {
  return db.all<HistoryEntry>(
    `SELECT h.id, h.item_id AS itemId, h.field, h.old_value AS oldValue, h.new_value AS newValue, u.name AS user, h.created_at AS createdAt
     FROM inventory_history h LEFT JOIN users u ON u.id = h.user_id WHERE h.item_id = ? ORDER BY h.id DESC LIMIT ?`,
    itemId,
    limit,
  );
}
