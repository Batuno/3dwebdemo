// Real sun position for the project's location, date and local clock time. Pure, no three.js.
import SunCalc from 'suncalc';

export const TIME_MIN = 6 * 60;
export const TIME_MAX = 21 * 60;
/** Landing time: dusk, with the sun low and the first windows lit. */
export const TIME_DEFAULT = 18 * 60 + 45;

/** Minutes east of UTC for a time zone at a given instant. */
export function zoneOffsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((local - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

export interface SunState {
  /** Degrees above the horizon; negative after sunset. */
  altitude: number;
  /** Compass bearing, degrees clockwise from true north. */
  bearing: number;
}

export interface SunLocation {
  latitude: number;
  longitude: number;
  timeZone: string;
}

/** Sun for a clock time (minutes after local midnight) on the local calendar day of `day`. */
export function sunAt(minutes: number, loc: SunLocation, day: Date = new Date()): SunState {
  const offset = zoneOffsetMinutes(loc.timeZone, day);
  const shifted = new Date(day.getTime() + offset * 60000);
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  const instant = new Date(midnight + (minutes - offset) * 60000);
  const p = SunCalc.getPosition(instant, loc.latitude, loc.longitude);
  const bearing = ((p.azimuth * 180) / Math.PI + 180 + 360) % 360;
  return { altitude: (p.altitude * 180) / Math.PI, bearing };
}

/** Unit vector toward the sun in site space, where plan north is -z, turned by the site's offset. */
export function sunDirection(s: SunState, northOffsetDeg: number): [number, number, number] {
  const theta = ((s.bearing + northOffsetDeg) * Math.PI) / 180;
  const alt = (s.altitude * Math.PI) / 180;
  return [Math.sin(theta) * Math.cos(alt), Math.sin(alt), -Math.cos(theta) * Math.cos(alt)];
}

export const clampTime = (m: number): number => Math.min(TIME_MAX, Math.max(TIME_MIN, Math.round(m)));

/** 1125 → "18:45" */
export function formatTime(minutes: number): string {
  const m = Math.round(minutes);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "18:30" → 1110; anything else → null. Out-of-range times clamp to the slider. */
export function parseTime(text: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text ?? '');
  if (!match) return null;
  const [h, m] = [Number(match[1]), Number(match[2])];
  if (h > 23 || m > 59) return null;
  return clampTime(h * 60 + m);
}
