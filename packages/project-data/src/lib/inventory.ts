import {
  blocks,
  garage,
  garageSeed,
  projectConfig,
  unitTypes,
  type BlockDef,
  type StackPlacement,
  type UnitTypeId,
} from '../data';
import { statusFor, type UnitStatus } from './availability';
import { pricePerM2At, unitPrice } from './pricing';

export interface Unit {
  id: string;
  block: string;
  storey: number;
  stack: number;
  type: UnitTypeId;
  status: UnitStatus;
  price: number;
  pricePerM2: number;
  totalArea: number;
  internalArea: number;
}

export interface StatusCounts {
  available: number;
  reserved: number;
  sold: number;
  total: number;
}

export const unitId = (block: string, storey: number, stack: number): string =>
  `${block}-${storey}-${stack}`;

/** Storeys that hold flats. Storey 1 is the void deck. */
export const unitStoreys = (b: BlockDef): number[] =>
  Array.from({ length: b.storeys - 1 }, (_, i) => i + 2);

function makeUnit(b: BlockDef, s: StackPlacement, storey: number): Unit {
  const t = unitTypes[s.type];
  const id = unitId(b.id, storey, s.stack);
  return {
    id,
    block: b.id,
    storey,
    stack: s.stack,
    type: s.type,
    status: statusFor(id, projectConfig.availability),
    price: unitPrice(t.totalArea, storey, projectConfig.pricing),
    pricePerM2: pricePerM2At(storey, projectConfig.pricing),
    totalArea: t.totalArea,
    internalArea: t.internalArea,
  };
}

export const allUnits: Unit[] = blocks.flatMap((b) =>
  unitStoreys(b).flatMap((storey) => b.stacks.map((s) => makeUnit(b, s, storey))),
);

const byId = new Map(allUnits.map((u) => [u.id, u]));

export const getUnit = (block: string, storey: number, stack: number): Unit | undefined =>
  byId.get(unitId(block, storey, stack));

export const unitsInBlock = (block: string): Unit[] => allUnits.filter((u) => u.block === block);

export const unitsOnFloor = (block: string, storey: number): Unit[] =>
  allUnits.filter((u) => u.block === block && u.storey === storey);

export function countStatuses(units: { status: UnitStatus }[]): StatusCounts {
  const c: StatusCounts = { available: 0, reserved: 0, sold: 0, total: 0 };
  for (const u of units) {
    c[u.status]++;
    c.total++;
  }
  return c;
}

/** Lowest price among units still for sale; falls back to all units when none are left. */
export function fromPrice(units: Unit[]): number {
  const open = units.filter((u) => u.status === 'available');
  const list = open.length ? open : units;
  return list.reduce((min, u) => Math.min(min, u.price), Infinity);
}

export function countByType(units: Unit[]): Record<UnitTypeId, number> {
  const out: Record<UnitTypeId, number> = {};
  for (const u of units) out[u.type] = (out[u.type] ?? 0) + 1;
  return out;
}

/* ---------- Garage ---------- */

export interface GarageBay {
  id: string;
  number: number;
  row: number;
  column: number;
  status: UnitStatus;
  price: number;
}

export const garageBays: GarageBay[] = Array.from({ length: garage.rows }, (_, row) =>
  Array.from({ length: garage.columns }, (_, column) => {
    const number = row * garage.columns + column + 1;
    return {
      id: `B1-${String(number).padStart(3, '0')}`,
      number,
      row,
      column,
      status: statusFor(`bay-${number}`, { ...projectConfig.availability, seed: garageSeed }),
      price: garage.bayPrice,
    };
  }),
).flat();
