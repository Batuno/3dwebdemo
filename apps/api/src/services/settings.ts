import { projectConfig, type PricingConfig } from '@bair/project-data';
import type { SqlDb, Statement } from '../db';
import { getMeta, setMetaStatement } from '../db';

export interface PricingSettings extends PricingConfig {
  bayPrice: number;
}

/** Base prices: project data until a superadmin changes them in the admin panel. */
export async function getPricing(db: SqlDb): Promise<PricingSettings> {
  const raw = await getMeta(db, 'pricing');
  const base: PricingSettings = { ...projectConfig.pricing, bayPrice: projectConfig.bayPrice };
  return raw ? { ...base, ...(JSON.parse(raw) as Partial<PricingSettings>) } : base;
}

export const setPricingStatement = (p: PricingSettings): Statement => setMetaStatement('pricing', JSON.stringify(p));
