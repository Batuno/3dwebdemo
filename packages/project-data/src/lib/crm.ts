// Types shared by the showroom, the website, the admin panel and the API: leads, analytics events and the
// live inventory the API hands to the showroom. No browser or Node code, so every side can import it.
import type { UnitStatus } from './availability';

/* ---------- Leads ---------- */

/** Where a buyer is in the sales pipeline. `lost` closes a lead that will not buy. */
export const LEAD_STATUSES = ['new', 'in_progress', 'meeting', 'order', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** What the buyer asked for: a viewing, information about a flat, or a call back from the website. */
export const LEAD_KINDS = ['viewing', 'info', 'contact'] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

/** Where the lead came from. The first two arrive by themselves; the rest are entered in the admin panel. */
export const LEAD_SOURCES = ['showroom', 'website', 'phone', 'walkin', 'referral', 'other'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/** What a public form posts to `POST /api/public/leads`. */
export interface LeadSubmission {
  kind: LeadKind;
  source: 'showroom' | 'website';
  name: string;
  phone: string;
  unitId?: string;
  /** Viewing only: YYYY-MM-DD and HH:MM. */
  date?: string;
  time?: string;
  question?: string;
  parkingBay?: string;
  /** The showroom's anonymous analytics session, so the admin can see what the buyer looked at. */
  session?: string;
  /** Honeypot: people never see it, so a filled one marks a bot. */
  website?: string;
}

/* ---------- Analytics ---------- */

export const VIEW_KINDS = ['overview', 'block', 'floor', 'unit', 'room', 'outdoor', 'garage'] as const;
export type ViewKind = (typeof VIEW_KINDS)[number];

export const ACTION_KINDS = ['lead_open', 'call', 'messenger', 'share', 'plan', 'parking'] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export type Device = 'mobile' | 'tablet' | 'desktop';

/** One thing a visitor did. The API works out the unit id, type and room from these fields. */
export interface TrackEvent {
  type: 'view' | 'action';
  view?: ViewKind;
  action?: ActionKind;
  block?: string;
  storey?: number;
  stack?: number;
  /** Hotspot id in a flat (its room comes from the interior) or the outdoor standing point. */
  spot?: string;
  /** Lead form kind, for `lead_open`. */
  kind?: LeadKind;
}

/** What the showroom posts to `POST /api/public/events`, a few seconds of events at a time. */
export interface TrackBatch {
  session: string;
  device: Device;
  events: TrackEvent[];
}

/* ---------- Live inventory ---------- */

/** Status and price of one flat or parking bay as the sales team set them. `l` is the list price before any sale. */
export interface ItemState {
  s: UnitStatus;
  p: number;
  l: number;
}

/** `GET /api/public/inventory`: every flat and bay, keyed by id. */
export interface InventorySnapshot {
  units: Record<string, ItemState>;
  bays: Record<string, ItemState>;
}

/** Whole-percent discount of a price against its list price; 0 when there is none. */
export const discountPercent = (price: number, listPrice: number): number =>
  listPrice > 0 && price < listPrice ? Math.round((1 - price / listPrice) * 100) : 0;
