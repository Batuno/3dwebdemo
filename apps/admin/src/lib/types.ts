// What the API returns, as the admin uses it. The shapes come from apps/api/src/services.
import type { LeadKind, LeadSource, LeadStatus, UnitStatus, UnitTypeId } from '@bair/project-data';

export type Role = 'superadmin' | 'admin' | 'sales';

export interface Me {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface AuthState {
  user: Me | null;
  needsSetup: boolean;
  setupEnabled: boolean;
  kdf: { iterations: number };
}

export interface Lead {
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
  duplicates: number;
}

export interface Activity {
  id: number;
  kind: string;
  body: string;
  createdAt: string;
  user: string | null;
}

export interface ItemView {
  id: string;
  kind: 'unit' | 'bay';
  status: UnitStatus;
  listPrice: number;
  price: number;
  onSale: boolean;
  discountPct: number | null;
  salePrice: number | null;
  saleUntil: string | null;
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

export interface Pricing {
  pricePerM2: number;
  floorPremium: number;
  bayPrice: number;
}

export interface UnitsResponse {
  units: UnitView[];
  interest: Record<string, { views: number; visitors: number }>;
  leadCounts: Record<string, number>;
  pricing: Pricing;
  canEdit: boolean;
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

export interface UserOption {
  id: number;
  name: string;
  role: Role;
}

export interface KeyTotal {
  key: string;
  views: number;
  visitors: number;
}

export interface AnalyticsData {
  range: { from: string; to: string };
  totals: { visitors: number; views: number; unitViews: number; roomViews: number; leadOpens: number; leads: number; showroomLeads: number };
  byDay: { day: string; visitors: number; views: number; leads: number }[];
  views: KeyTotal[];
  byBlock: KeyTotal[];
  floors: { block: string; storey: number; views: number; visitors: number }[];
  topUnits: KeyTotal[];
  byType: KeyTotal[];
  byRoom: KeyTotal[];
  outdoor: KeyTotal[];
  devices: { key: string; visits: number }[];
  hours: { hour: number; views: number }[];
  actions: KeyTotal[];
  funnel: Record<'visitors' | 'block' | 'floor' | 'unit' | 'leadOpen' | 'lead', number>;
}

export interface StatusCount {
  available: number;
  reserved: number;
  sold: number;
  total: number;
}

export interface DashboardData {
  today: string;
  units: StatusCount & { soldValue: number; reservedValue: number; availableValue: number; onSale: number; byBlock: (StatusCount & { block: string })[] };
  bays: StatusCount;
  leads: { byStatus: Record<LeadStatus, number>; total: number; last7: number; prev7: number; today: number; unassignedNew: number };
  visitors: { last7: number; prev7: number };
  days: { day: string; leads: number; visitors: number }[];
  topUnits: { id: string; views: number; visitors: number; status?: UnitStatus; price?: number; type?: UnitTypeId }[];
  reservations: { id: string; reservedUntil: string; leadId: number | null; expired: boolean }[];
  followUps: { id: number; name: string; phone: string; unitId: string | null; status: LeadStatus; nextActionAt: string; assigned: string | null }[];
  recentLeads: { id: number; name: string; phone: string; unitId: string | null; kind: LeadKind; source: LeadSource; status: LeadStatus; createdAt: string }[];
  soldWeeks: { from: string; sold: number }[];
}
