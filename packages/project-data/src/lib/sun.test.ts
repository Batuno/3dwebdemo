import { describe, expect, it } from 'vitest';
import { clampTime, formatTime, parseTime, sunAt, sunDirection, TIME_MAX, TIME_MIN, zoneOffsetMinutes } from './sun';

const loc = { latitude: 1.37, longitude: 103.84, timeZone: 'Asia/Singapore' };
const day = new Date('2026-11-03T04:00:00Z');

describe('sun position', () => {
  it('reads the zone offset', () => {
    expect(zoneOffsetMinutes('Asia/Singapore', day)).toBe(480);
    expect(zoneOffsetMinutes('UTC', day)).toBe(0);
  });

  it('is high around midday and below the horizon late at night', () => {
    expect(sunAt(12 * 60 + 45, loc, day).altitude).toBeGreaterThan(65);
    expect(sunAt(21 * 60, loc, day).altitude).toBeLessThan(-20);
  });

  it('rises in the east and sets in the west', () => {
    const morning = sunAt(8 * 60, loc, day);
    const evening = sunAt(18 * 60, loc, day);
    expect(morning.bearing).toBeGreaterThan(60);
    expect(morning.bearing).toBeLessThan(130);
    expect(evening.bearing).toBeGreaterThan(230);
    expect(evening.bearing).toBeLessThan(300);
  });

  it('keeps the default dusk time just above the horizon', () => {
    const dusk = sunAt(18 * 60 + 45, loc, day).altitude;
    expect(dusk).toBeGreaterThan(-4);
    expect(dusk).toBeLessThan(12);
  });

  it('turns bearings into site directions', () => {
    const east = sunDirection({ altitude: 0, bearing: 90 }, 0);
    expect(east[0]).toBeCloseTo(1);
    expect(east[2]).toBeCloseTo(0);
    const north = sunDirection({ altitude: 0, bearing: 0 }, 0);
    expect(north[2]).toBeCloseTo(-1);
    const up = sunDirection({ altitude: 90, bearing: 0 }, -10);
    expect(up[1]).toBeCloseTo(1);
  });
});

describe('time values', () => {
  it('formats and parses', () => {
    expect(formatTime(1125)).toBe('18:45');
    expect(formatTime(360)).toBe('06:00');
    expect(parseTime('18:30')).toBe(1110);
  });

  it('rejects bad text and clamps to the slider range', () => {
    expect(parseTime('abc')).toBeNull();
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime(null)).toBeNull();
    expect(parseTime('03:00')).toBe(TIME_MIN);
    expect(parseTime('23:30')).toBe(TIME_MAX);
    expect(clampTime(100)).toBe(TIME_MIN);
  });
});
