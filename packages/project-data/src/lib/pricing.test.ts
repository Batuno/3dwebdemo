import { describe, expect, it } from 'vitest';
import { pricePerM2At, unitPrice } from './pricing';
import { formatPrice, formatPriceShort, unitNumber } from './format';
import { isValidMongolianPhone, normalizePhone } from './phone';
import { statusFor } from './availability';

const cfg = { pricePerM2: 4_770_000, floorPremium: 0.004 };

describe('pricing', () => {
  it('prices storey 2 at the base rate', () => {
    expect(unitPrice(90, 2, cfg)).toBe(429_300_000);
    expect(unitPrice(40, 2, cfg)).toBe(190_800_000);
  });
  it('adds 0.4% per storey above 2', () => {
    expect(unitPrice(90, 12, cfg)).toBe(Math.round(429_300_000 * 1.04));
    expect(unitPrice(90, 24, cfg)).toBe(Math.round(429_300_000 * 1.088));
    expect(pricePerM2At(12, cfg)).toBe(Math.round(4_770_000 * 1.04));
  });
});

describe('availability', () => {
  const a = { seed: 's', available: 0.6, reserved: 0.15, sold: 0.25 };
  it('is deterministic for a key and sensitive to the seed', () => {
    expect(statusFor('804A-12-325', a)).toBe(statusFor('804A-12-325', a));
    const keys = Array.from({ length: 200 }, (_, i) => `k${i}`);
    const one = keys.map((k) => statusFor(k, a)).join();
    const two = keys.map((k) => statusFor(k, { ...a, seed: 'other' })).join();
    expect(one).not.toBe(two);
  });
});

describe('format', () => {
  it('formats prices the way the brief asks', () => {
    expect(formatPrice(429_300_000)).toBe('429,300,000 ₮');
    expect(formatPriceShort(429_300_000)).toBe('429.3 сая ₮');
    expect(formatPriceShort(190_800_000)).toBe('190.8 сая ₮');
    expect(unitNumber(12, 325)).toBe('#12-325');
    expect(unitNumber(2, 325)).toBe('#02-325');
  });
});

describe('phone', () => {
  it('accepts 8-digit Mongolian numbers', () => {
    expect(isValidMongolianPhone('99112233')).toBe(true);
    expect(isValidMongolianPhone('9911 2233')).toBe(true);
    expect(isValidMongolianPhone('+976 8811-2233')).toBe(true);
    expect(normalizePhone('+976 8811-2233')).toBe('88112233');
  });
  it('rejects other input', () => {
    expect(isValidMongolianPhone('9911223')).toBe(false);
    expect(isValidMongolianPhone('991122334')).toBe(false);
    expect(isValidMongolianPhone('19112233')).toBe(false);
    expect(isValidMongolianPhone('abcd')).toBe(false);
  });
});
