import { blocks, LEAD_STATUSES, type LeadStatus } from '@bair/project-data';
import { addDays, dayStartIso, localDay } from '../lib/time';
import type { SqlDb } from '../db';
import { getPricing } from './settings';
import { listBays, listUnits } from './inventory';
import { analytics } from './analytics';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const byStatus = (list: { status: string }[]) => ({
  available: list.filter((u) => u.status === 'available').length,
  reserved: list.filter((u) => u.status === 'reserved').length,
  sold: list.filter((u) => u.status === 'sold').length,
  total: list.length,
});

export async function dashboard(db: SqlDb) {
  const today = localDay();
  const from30 = addDays(today, -29);
  const pricing = await getPricing(db);
  const [units, bays, a, statusRows, counts, followUps, recentLeads, soldRows] = await Promise.all([
    listUnits(db, pricing),
    listBays(db, pricing),
    analytics(db, { from: from30, to: today }),
    db.all<{ status: LeadStatus; n: number }>('SELECT status, COUNT(*) AS n FROM leads GROUP BY status'),
    db.get<{ last7: number; prev7: number; today: number; unassigned: number }>(
      `SELECT
         (SELECT COUNT(*) FROM leads WHERE created_at >= ?) AS last7,
         (SELECT COUNT(*) FROM leads WHERE created_at >= ? AND created_at < ?) AS prev7,
         (SELECT COUNT(*) FROM leads WHERE created_at >= ?) AS today,
         (SELECT COUNT(*) FROM leads WHERE status = 'new' AND assigned_to IS NULL) AS unassigned`,
      dayStartIso(addDays(today, -6)),
      dayStartIso(addDays(today, -13)),
      dayStartIso(addDays(today, -6)),
      dayStartIso(today),
    ),
    db.all(
      `SELECT l.id, l.name, l.phone, l.unit_id AS unitId, l.status, l.next_action_at AS nextActionAt, u.name AS assigned
       FROM leads l LEFT JOIN users u ON u.id = l.assigned_to
       WHERE l.next_action_at IS NOT NULL AND l.next_action_at <= ? AND l.status NOT IN ('order', 'lost')
       ORDER BY l.next_action_at LIMIT 10`,
      today,
    ),
    db.all(
      `SELECT id, name, phone, unit_id AS unitId, kind, source, status, created_at AS createdAt
       FROM leads ORDER BY created_at DESC, id DESC LIMIT 8`,
    ),
    db.all<{ created_at: string }>("SELECT created_at FROM inventory_history WHERE field = 'status' AND new_value = 'sold' AND created_at >= ?", dayStartIso(addDays(today, -55))),
  ]);

  const leadCounts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>;
  for (const r of statusRows) leadCounts[r.status] = r.n;
  const value = (status: string) => sum(units.filter((u) => u.status === status).map((u) => u.price));

  const unitById = new Map(units.map((u) => [u.id, u]));
  const topUnits = a.topUnits.slice(0, 6).map((t) => {
    const u = unitById.get(t.key);
    return { id: t.key, views: t.views, visitors: t.visitors, status: u?.status, price: u?.price, type: u?.type };
  });

  const soon = addDays(today, 3);
  const reservations = units
    .filter((u) => u.status === 'reserved' && u.reservedUntil && u.reservedUntil <= soon)
    .sort((x, y) => x.reservedUntil!.localeCompare(y.reservedUntil!))
    .slice(0, 10)
    .map((u) => ({ id: u.id, reservedUntil: u.reservedUntil, leadId: u.leadId, expired: u.reservedUntil! < today }));

  // Flats that changed to sold, per week, for the last 8 weeks.
  const weeks = Array.from({ length: 8 }, (_, i) => ({ from: addDays(today, -55 + i * 7), sold: 0 }));
  for (const r of soldRows) {
    const d = localDay(new Date(r.created_at));
    const w = weeks.findLast((x) => x.from <= d);
    if (w) w.sold++;
  }

  const visitors = (from: string, to: string) => sum(a.byDay.filter((d) => d.day >= from && d.day <= to).map((d) => d.visitors));

  return {
    today,
    units: {
      ...byStatus(units),
      soldValue: value('sold'),
      reservedValue: value('reserved'),
      availableValue: value('available'),
      onSale: units.filter((u) => u.onSale && u.status === 'available' && u.price < u.listPrice).length,
      byBlock: blocks.map((b) => ({ block: b.id, ...byStatus(units.filter((u) => u.block === b.id)) })),
    },
    bays: byStatus(bays),
    leads: {
      byStatus: leadCounts,
      total: sum(Object.values(leadCounts)),
      last7: counts?.last7 ?? 0,
      prev7: counts?.prev7 ?? 0,
      today: counts?.today ?? 0,
      unassignedNew: counts?.unassigned ?? 0,
    },
    visitors: { last7: visitors(addDays(today, -6), today), prev7: visitors(addDays(today, -13), addDays(today, -7)) },
    days: a.byDay.map((d) => ({ day: d.day, leads: d.leads, visitors: d.visitors })),
    topUnits,
    reservations,
    followUps,
    recentLeads,
    soldWeeks: weeks,
  };
}
