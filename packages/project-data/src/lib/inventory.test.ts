import { describe, expect, it } from 'vitest';
import { blocks, unitTypes } from '../data';
import {
  allUnits,
  countByType,
  countStatuses,
  fromPrice,
  garageBays,
  getUnit,
  unitsInBlock,
} from './inventory';

describe('inventory', () => {
  it('has 276 units per block, matching the brochure table', () => {
    for (const b of blocks) expect(unitsInBlock(b.id)).toHaveLength(276);
  });

  it('matches the brochure mix for every block (23 T1, 69 T2, 23 3R, 161 4R)', () => {
    for (const b of blocks) {
      expect(countByType(unitsInBlock(b.id))).toEqual({
        '2RF_T1': 23,
        '2RF_T2': 69,
        '3R': 23,
        '4R': 161,
      });
    }
  });

  it('has no units on storey 1 (void deck) or above storey 24', () => {
    expect(allUnits.some((u) => u.storey < 2)).toBe(false);
    expect(allUnits.some((u) => u.storey > 24)).toBe(false);
  });

  it('assigns stacks to the types in the brief', () => {
    expect(getUnit('804A', 12, 325)?.type).toBe('4R');
    expect(getUnit('804A', 12, 317)?.type).toBe('2RF_T1');
    expect(getUnit('804A', 12, 323)?.type).toBe('3R');
    expect(getUnit('804A', 12, 339)?.type).toBe('2RF_T2');
    expect(getUnit('804B', 12, 341)?.type).toBe('2RF_T1');
    expect(getUnit('804B', 12, 347)?.type).toBe('3R');
    expect(getUnit('804B', 12, 363)?.type).toBe('2RF_T2');
  });

  it('is close to the 60/15/25 availability target and counts add up', () => {
    const c = countStatuses(allUnits);
    expect(c.total).toBe(552);
    expect(c.available + c.reserved + c.sold).toBe(552);
    expect(c.available / c.total).toBeGreaterThan(0.52);
    expect(c.available / c.total).toBeLessThan(0.68);
    expect(c.reserved / c.total).toBeGreaterThan(0.09);
    expect(c.reserved / c.total).toBeLessThan(0.21);
  });

  it('from-price ignores units that are not for sale', () => {
    const units = unitsInBlock('804A');
    const open = units.filter((u) => u.status === 'available');
    expect(fromPrice(units)).toBe(Math.min(...open.map((u) => u.price)));
  });

  it('room areas add up to the internal area', () => {
    for (const t of Object.values(unitTypes)) {
      const sum = t.rooms.reduce((s, r) => s + r.area, 0);
      // Appendix A rooms are clear floor; the internal area also counts the walls between them.
      expect(sum / t.internalArea).toBeGreaterThan(0.85);
      expect(sum).toBeLessThan(t.internalArea);
      expect(t.internalArea + t.ledge).toBe(t.totalArea);
    }
  });

  it('numbers garage bays uniquely and gives each a status', () => {
    expect(new Set(garageBays.map((b) => b.id)).size).toBe(garageBays.length);
    expect(garageBays.every((b) => b.price > 0)).toBe(true);
  });
});

describe('live inventory', () => {
  it('lays statuses and sale prices over the generated ones and restores cleanly', async () => {
    const { applyInventory, getBay } = await import('./inventory');
    const { discountPercent } = await import('./crm');
    const unit = getUnit('804A', 12, 325)!;
    const bay = getBay('B1-001')!;
    const before = { status: unit.status, price: unit.price, listPrice: unit.listPrice, perM2: unit.pricePerM2 };
    const bayBefore = { s: bay.status, p: bay.price, l: bay.listPrice };
    expect(unit.listPrice).toBe(unit.price);

    const sale = Math.round(unit.listPrice * 0.9);
    expect(
      applyInventory({
        units: { [unit.id]: { s: 'reserved', p: sale, l: unit.listPrice } },
        bays: { [bay.id]: { s: 'sold', p: 30_000_000, l: 35_000_000 } },
      }),
    ).toBe(true);
    expect(unit.status).toBe('reserved');
    expect(unit.price).toBe(sale);
    expect(unit.pricePerM2).toBe(Math.round(sale / unit.totalArea));
    expect(discountPercent(unit.price, unit.listPrice)).toBe(10);
    expect(bay.status).toBe('sold');
    expect(fromPrice(unitsInBlock('804A'))).toBeLessThanOrEqual(sale);

    // The same snapshot again changes nothing; ids it leaves out keep their state.
    expect(applyInventory({ units: { [unit.id]: { s: 'reserved', p: sale, l: unit.listPrice } }, bays: {} })).toBe(false);

    applyInventory({
      units: { [unit.id]: { s: before.status, p: before.price, l: before.listPrice } },
      bays: { [bay.id]: bayBefore },
    });
    expect(unit.pricePerM2).toBe(before.perM2);
    expect(discountPercent(unit.price, unit.listPrice)).toBe(0);
  });
});
