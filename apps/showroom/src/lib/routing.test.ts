import { describe, expect, it } from 'vitest';
import { parseHash, toHash } from './routing';

describe('routing', () => {
  it('parses deep links', () => {
    expect(parseHash('#/804A/12/325')).toEqual({
      view: 'unit',
      block: '804A',
      storey: 12,
      stack: 325,
    });
    expect(parseHash('#/804A/12/325/living-1')).toEqual({
      view: 'unit',
      block: '804A',
      storey: 12,
      stack: 325,
      spot: 'living-1',
    });
    expect(parseHash('#/804B/2')).toEqual({ view: 'floor', block: '804B', storey: 2 });
    expect(parseHash('#/804A')).toEqual({ view: 'block', block: '804A' });
    expect(parseHash('#/garage')).toEqual({ view: 'garage' });
    expect(parseHash('#/outdoor/playground')).toEqual({ view: 'outdoor', spot: 'playground' });
    expect(parseHash('')).toEqual({ view: 'overview' });
  });
  it('falls back safely on bad links', () => {
    expect(parseHash('#/999')).toEqual({ view: 'overview' });
    expect(parseHash('#/outdoor/nowhere')).toEqual({ view: 'overview' });
    expect(parseHash('#/804A/1')).toEqual({ view: 'block', block: '804A' });
    expect(parseHash('#/804A/25')).toEqual({ view: 'block', block: '804A' });
    expect(parseHash('#/804A/12/341')).toEqual({ view: 'floor', block: '804A', storey: 12 });
    // 317 is a 2-room flat, which has no master bedroom.
    expect(parseHash('#/804A/12/317/master-1')).toEqual({ view: 'unit', block: '804A', storey: 12, stack: 317 });
  });
  it('round-trips', () => {
    for (const h of ['#/', '#/garage', '#/804A', '#/804A/12', '#/804B/24/363', '#/804A/12/325/master-1', '#/outdoor/court']) {
      expect(toHash(parseHash(h))).toBe(h);
    }
  });
});
