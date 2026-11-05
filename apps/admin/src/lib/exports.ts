// Spreadsheets built in the browser from data the panel already loaded. The API only records that an export
// happened (POST /api/audit/export): building files there would not fit Cloudflare's free CPU limit.
import { ta, unitNumber } from '@bair/project-data';
import { outdoorLabel, roomName, typeName } from './labels';
import { post } from './api';
import { stamp, today } from './format';
import { CSV_TYPE, toCsv, toXlsx, XLSX_TYPE, type Sheet } from './sheets';
import type { AnalyticsData, BayView, Lead, UnitsResponse } from './types';

const c = ta.export.columns;

export function leadsSheet(leads: Lead[]): Sheet {
  return {
    name: ta.export.leads,
    header: [c.id, c.created, c.name, c.phone, c.kind, c.source, c.status, c.unit, c.viewingDate, c.viewingTime, c.question, c.parking, c.assigned, c.nextAction, c.updated],
    rows: leads.map((l) => [
      l.id,
      stamp(l.created_at),
      l.name,
      l.phone,
      ta.leadKind[l.kind] ?? l.kind,
      ta.leadSource[l.source] ?? l.source,
      ta.leadStatus[l.status] ?? l.status,
      l.unit_id,
      l.viewing_date,
      l.viewing_time,
      l.question,
      l.parking_bay,
      l.assigned_name,
      l.next_action_at,
      stamp(l.updated_at),
    ]),
  };
}

export function unitsSheet(d: UnitsResponse): Sheet {
  return {
    name: ta.export.units,
    header: [c.unit, c.block, c.storey, c.stack, c.type, c.area, c.status, c.listPrice, c.price, c.discount, c.saleUntil, c.reservedUntil, c.leadId, c.leads, c.views, c.visitors, c.note, c.updated],
    rows: d.units.map((u) => [
      `${u.block} ${unitNumber(u.storey, u.stack)}`,
      u.block,
      u.storey,
      u.stack,
      typeName(u.type),
      u.totalArea,
      ta.unitStatus[u.status],
      u.listPrice,
      u.price,
      u.price < u.listPrice ? Math.round((1 - u.price / u.listPrice) * 1000) / 10 : null,
      u.onSale ? u.saleUntil : null,
      u.reservedUntil,
      u.leadId,
      d.leadCounts[u.id] ?? 0,
      d.interest[u.id]?.views ?? 0,
      d.interest[u.id]?.visitors ?? 0,
      u.note,
      stamp(u.updatedAt),
    ]),
  };
}

export function baysSheet(bays: BayView[]): Sheet {
  return {
    name: ta.export.bays,
    header: [c.bay, c.status, c.listPrice, c.price, c.reservedUntil, c.leadId, c.note, c.updated],
    rows: bays.map((b) => [b.id, ta.unitStatus[b.status], b.listPrice, b.price, b.reservedUntil, b.leadId, b.note, stamp(b.updatedAt)]),
  };
}

/** The analytics page as sheets: by day, floors, flats, blocks, types, rooms, outdoor, devices, hours, funnel. */
export function analyticsSheets(a: AnalyticsData): Sheet[] {
  return [
    { name: ta.analytics.perDay, header: [c.day, c.visitors, c.views, c.leads], rows: a.byDay.map((d) => [d.day, d.visitors, d.views, d.leads]) },
    {
      name: ta.analytics.floorHeat,
      header: [c.block, c.storey, c.views, c.visitors],
      rows: [...a.floors].sort((x, y) => x.block.localeCompare(y.block) || y.storey - x.storey).map((f) => [f.block, f.storey, f.views, f.visitors]),
    },
    { name: ta.analytics.topUnits, header: [c.unit, c.views, c.visitors], rows: a.topUnits.map((u) => [u.key, u.views, u.visitors]) },
    { name: ta.analytics.byBlock, header: [c.block, c.views, c.visitors], rows: a.byBlock.map((b) => [b.key, b.views, b.visitors]) },
    { name: ta.analytics.byType, header: [c.type, c.views, c.visitors], rows: a.byType.map((b) => [typeName(b.key), b.views, b.visitors]) },
    { name: ta.analytics.byRoom, header: [c.name2, c.views], rows: a.byRoom.map((b) => [roomName(b.key), b.views]) },
    { name: ta.analytics.outdoor, header: [c.name2, c.views], rows: a.outdoor.map((b) => [outdoorLabel(b.key), b.views]) },
    { name: ta.analytics.devices, header: [c.name2, c.visitors], rows: a.devices.map((d) => [ta.device[d.key] ?? d.key, d.visits]) },
    { name: ta.analytics.hours, header: [c.hour, c.views], rows: a.hours.map((h) => [h.hour, h.views]) },
    { name: ta.analytics.funnel, header: [c.step, c.count], rows: Object.entries(a.funnel).map(([k, v]) => [ta.analytics.funnelSteps[k] ?? k, v]) },
  ];
}

export type ExportWhat = 'leads' | 'units' | 'bays' | 'analytics' | 'all';

/** Saves the sheets as a file and records the export. CSV holds the first sheet. */
export async function saveExport(what: ExportWhat, format: 'csv' | 'xlsx', sheets: Sheet[], filter?: Record<string, string>) {
  const name = `bair-${what}-${today()}.${format}`;
  const blob = format === 'csv' ? new Blob([toCsv(sheets[0])], { type: CSV_TYPE }) : new Blob([toXlsx(sheets) as BlobPart], { type: XLSX_TYPE });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  const rows = format === 'csv' ? sheets[0].rows.length : sheets.reduce((n, s) => n + s.rows.length, 0);
  await post('/api/audit/export', { what, format, rows, filter }).catch(() => undefined);
}
