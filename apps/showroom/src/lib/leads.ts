import { normalizePhone, projectConfig } from '@bair/project-data';
import { apiEnabled, apiUrl } from './api';
import { sessionId } from './analytics';

export type LeadKind = 'viewing' | 'info';

export interface Lead {
  kind: LeadKind;
  unitId: string;
  name: string;
  phone: string;
  /** Viewing only. */
  date?: string;
  time?: string;
  /** Info only. */
  question?: string;
  /** Parking bay chosen with this unit, if any. */
  parkingBay?: string;
  createdAt: string;
  project: string;
  source?: 'showroom';
  /** The visit id, so the admin panel can show what the buyer looked at. */
  session?: string;
}

const KEY = 'bair.leads';
/** Leads the server did not take yet; sent again the next time the showroom opens. */
const PENDING = 'bair.pendingLeads';
const PENDING_DAYS = 14;

const read = (key: string): Lead[] => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as Lead[];
  } catch {
    return [];
  }
};
const write = (key: string, list: Lead[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Storage blocked: nothing more to do.
  }
};

export const storedLeads = (): Lead[] => read(KEY);

const endpoint = (): string => projectConfig.leads.endpoint || (apiEnabled ? apiUrl('/api/public/leads') : '');

async function send(lead: Lead): Promise<boolean> {
  try {
    const res = await fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) });
    // A 4xx means the server will never take this lead (bad number, too many); retrying would not help.
    return res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429);
  } catch {
    return false;
  }
}

/**
 * The one exit point for leads. Always keeps a local copy, then posts to the API (or leads.endpoint) when one
 * is set. Returns false only if the post failed; the lead is then kept and sent again on the next visit.
 */
export async function submitLead(input: Omit<Lead, 'createdAt' | 'project' | 'source' | 'session'>): Promise<boolean> {
  const lead: Lead = {
    ...input,
    phone: normalizePhone(input.phone),
    createdAt: new Date().toISOString(),
    project: projectConfig.projectName,
    source: 'showroom',
    session: sessionId(),
  };
  write(KEY, [...storedLeads(), lead]);
  if (!endpoint()) return true;
  const ok = await send(lead);
  if (!ok) write(PENDING, [...read(PENDING), lead]);
  return ok;
}

/** Sends leads that failed earlier, for example while the visitor was offline. */
export async function retryPendingLeads() {
  const pending = read(PENDING);
  if (!pending.length || !endpoint()) return;
  const cutoff = Date.now() - PENDING_DAYS * 86400_000;
  const left: Lead[] = [];
  for (const lead of pending) {
    if (Date.parse(lead.createdAt) < cutoff) continue;
    if (!(await send(lead))) left.push(lead);
  }
  write(PENDING, left);
}
