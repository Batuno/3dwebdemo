import { pad2, unitNumber } from '@bair/project-data';

/** 429300000 → "429,300,000 ₮" */
export const money = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v).toLocaleString('en-US')} ₮`);
/** Sums of many flats: 27805100000 → "27.8 тэрбум ₮", smaller ones as millions. */
export const bigMoney = (v: number) => (Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(1).replace(/\.0$/, '')} тэрбум ₮` : `${millions(v)} ₮`);
/** 429300000 → "429.3 сая" */
export const millions = (v: number | null | undefined) => (v == null ? '—' : `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')} сая`);
/** 1284 → "1,284"; 12900 → "12.9K" */
export const compact = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : n.toLocaleString('en-US'));
export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

/** "804A-12-325" → "804A #12-325" */
export function unitLabel(id: string | null | undefined): string {
  if (!id) return '—';
  const [block, storey, stack] = id.split('-');
  return `${block} ${unitNumber(Number(storey), Number(stack))}`;
}

const dt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** ISO → "2026-11-05 14:30" in the viewer's time zone. */
export const stamp = (iso: string | null | undefined) => (iso ? dt.format(new Date(iso)).replace(', ', ' ') : '—');
export const day = (iso: string | null | undefined) => (iso ? stamp(iso).slice(0, 10) : '—');

/** Today as YYYY-MM-DD in the viewer's time zone. */
export function today(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400_000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "2026-11-05" → "11/05" for chart axes. */
export const shortDay = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}`;
