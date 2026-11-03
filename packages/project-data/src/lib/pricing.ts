export interface PricingConfig {
  pricePerM2: number;
  floorPremium: number;
}

/** price = totalArea × pricePerM2 × (1 + floorPremium × (storey − 2)) */
export function unitPrice(totalArea: number, storey: number, cfg: PricingConfig): number {
  return Math.round(totalArea * cfg.pricePerM2 * (1 + cfg.floorPremium * (storey - 2)));
}

export function pricePerM2At(storey: number, cfg: PricingConfig): number {
  return Math.round(cfg.pricePerM2 * (1 + cfg.floorPremium * (storey - 2)));
}
