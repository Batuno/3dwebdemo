/** 429300000 → "429,300,000 ₮" */
export function formatPrice(v: number): string {
  return `${Math.round(v).toLocaleString('en-US')} ₮`;
}

/** 429300000 → "429.3 сая ₮" */
export function formatPriceShort(v: number): string {
  return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')} сая ₮`;
}

export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** "#12-325" */
export const unitNumber = (storey: number, stack: number): string => `#${pad2(storey)}-${stack}`;
