import { seededUnit } from './rng';

export type UnitStatus = 'available' | 'reserved' | 'sold';

export interface AvailabilityConfig {
  seed: string;
  available: number;
  reserved: number;
  sold: number;
}

/** Deterministic: the same key always gets the same status. */
export function statusFor(key: string, cfg: AvailabilityConfig): UnitStatus {
  const u = seededUnit(`${cfg.seed}:${key}`);
  if (u < cfg.available) return 'available';
  if (u < cfg.available + cfg.reserved) return 'reserved';
  return 'sold';
}
