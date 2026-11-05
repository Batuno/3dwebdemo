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
import type { InventorySnapshot } from './crm';
import { pricePerM2At, unitPrice } from './pricing';

export interface Unit {
  id: string;
  block: string;
  storey: number;
  stack: number;
  type: UnitTypeId;
  status: UnitStatus;
  /** What the buyer pays now: the list price, or less during a sale. */
  price: number;
  /** Price before any sale. Equal to `price` when nothing is discounted. */
  listPrice: number;
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
  const price = unitPrice(t.totalArea, storey, projectConfig.pricing);
  return {
    id,
    block: b.id,
    storey,
    stack: s.stack,
    type: s.type,
    status: statusFor(id, projectConfig.availability),
    price,
    listPrice: price,
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
  listPrice: number;
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
      listPrice: garage.bayPrice,
    };
  }),
).flat();

const bayById = new Map(garageBays.map((b) => [b.id, b]));
export const getBay = (id: string): GarageBay | undefined => bayById.get(id);

/* ---------- Live state from the sales team ---------- */

/**
 * Lays the API's statuses and prices over the generated ones, in place, so every existing reader sees them.
 * Ids the snapshot does not mention keep their current state. Returns true when anything changed.
 */
export function applyInventory(snap: InventorySnapshot): boolean {
  let changed = false;
  for (const u of allUnits) {
    const s = snap.units[u.id];
    if (!s || (s.s === u.status && s.p === u.price && s.l === u.listPrice)) continue;
    u.status = s.s;
    u.price = s.p;
    u.listPrice = s.l;
    u.pricePerM2 = Math.round(s.p / u.totalArea);
    changed = true;
  }
  for (const b of garageBays) {
    const s = snap.bays[b.id];
    if (!s || (s.s === b.status && s.p === b.price && s.l === b.listPrice)) continue;
    b.status = s.s;
    b.price = s.p;
    b.listPrice = s.l;
    changed = true;
  }
  return changed;
}
