import { projectConfig } from '@bair/project-data';

/** Reports count days in the project's own time zone, so "today" matches the sales office. */
export const REPORT_TZ = process.env.REPORT_TZ || projectConfig.timeZone;

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: REPORT_TZ, hour: '2-digit', hourCycle: 'h23' });
const stampFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORT_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** YYYY-MM-DD in the report time zone. */
export const localDay = (d: Date = new Date()): string => dayFmt.format(d);
export const localHour = (d: Date = new Date()): number => Number(hourFmt.format(d)) % 24;
/** "2026-11-05 14:30" in the report time zone, for exports. */
export const localStamp = (iso: string | null | undefined): string => (iso ? stampFmt.format(new Date(iso)).replace(', ', ' ') : '');

/** The day `n` days before `day` (both YYYY-MM-DD). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Every day from `from` to `to`, inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 4000; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The UTC instant at which a report-zone day starts, for comparing against ISO timestamps. */
export function dayStartIso(day: string): string {
  // Probe the zone's offset at noon that day; zones with a DST jump at midnight are not a concern here.
  const noon = new Date(`${day}T12:00:00Z`);
  const local = new Date(stampFmt.format(noon).replace(', ', 'T') + ':00Z');
  const offset = local.getTime() - noon.getTime();
  return new Date(Date.parse(`${day}T00:00:00Z`) - offset).toISOString();
}
