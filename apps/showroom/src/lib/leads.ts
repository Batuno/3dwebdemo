import { projectConfig } from '@bair/project-data';
import { normalizePhone } from '@bair/project-data';

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
}

const KEY = 'bair.leads';

export function storedLeads(): Lead[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Lead[];
  } catch {
    return [];
  }
}

/**
 * The one exit point for leads. Always keeps a local copy, then posts to
 * projectConfig.leads.endpoint when one is set. Returns false only if the post failed.
 */
export async function submitLead(input: Omit<Lead, 'createdAt' | 'project'>): Promise<boolean> {
  const lead: Lead = {
    ...input,
    phone: normalizePhone(input.phone),
    createdAt: new Date().toISOString(),
    project: projectConfig.projectName,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([...storedLeads(), lead]));
  } catch {
    // Storage blocked: the POST below is still attempted.
  }
  const { endpoint } = projectConfig.leads;
  if (!endpoint) return true;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });
    return res.ok;
  } catch {
    return false;
  }
}
