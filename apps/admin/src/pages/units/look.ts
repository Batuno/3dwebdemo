import { ta, unitNumber, unitTypes, type UnitStatus } from '@bair/project-data';
import { heatColor, heatInk, heatStep } from '../../charts/charts';
import { money } from '../../lib/format';
import type { UnitView } from '../../lib/types';

export type ColorBy = 'status' | 'interest' | 'type';

const STATUS_INK: Record<UnitStatus, string> = { available: '#ffffff', reserved: '#15191c', sold: '#ffffff' };

/** The fill and text colour of a flat, the same in every view of the flats page. */
export function unitColors(u: UnitView, colorBy: ColorBy, visitors: number, maxVisitors: number): { fill: string; ink: string } {
  if (colorBy === 'status') return { fill: `var(--st-${u.status})`, ink: STATUS_INK[u.status] };
  if (colorBy === 'interest') return { fill: heatColor(visitors, maxVisitors), ink: heatInk(heatStep(visitors, maxVisitors)) };
  return { fill: unitTypes[u.type].color, ink: '#15191c' };
}

/** A flat in one line, for tooltips and screen readers. */
export function describeUnit(u: UnitView, visitors: number): string {
  const U = ta.units;
  const sale = u.price < u.listPrice ? ` (${U.onSale})` : '';
  return `${u.block} ${unitNumber(u.storey, u.stack)} · ${ta.unitStatus[u.status]} · ${money(u.price)}${sale} · ${U.visitorsShort(visitors)}`;
}
