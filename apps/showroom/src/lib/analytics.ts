// Anonymous visit statistics for the admin panel: which blocks, floors, flats and rooms people look at.
// A random id per browser tab, no cookies, nothing personal; visitors who ask not to be tracked
// (Do Not Track or Global Privacy Control) are not. Events go out a few at a time.
import type { ActionKind, Device, LeadKind, TrackEvent } from '@bair/project-data';
import type { Route } from './routing';
import { apiEnabled, apiUrl } from './api';

const KEY = 'bair.session';
const FLUSH_MS = 6000;
const MAX_BATCH = 50;

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('');
}

/** This tab's visit id. Also sent with a lead, so the sales team sees which flats the buyer looked at. */
export function sessionId(): string {
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) sessionStorage.setItem(KEY, (id = randomId()));
    return id;
  } catch {
    return (sessionIdFallback ??= randomId());
  }
}
let sessionIdFallback: string | undefined;

function device(): Device {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'tablet';
  return /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
}

const enabled = () => apiEnabled && !optedOut();
const queue: TrackEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function flush(leaving = false) {
  clearTimeout(timer);
  timer = undefined;
  while (queue.length) {
    const body = JSON.stringify({ session: sessionId(), device: device(), events: queue.splice(0, MAX_BATCH) });
    // text/plain keeps this a simple request, so a server on another address needs no CORS preflight.
    const url = apiUrl('/api/public/events');
    if (leaving && navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' }))) continue;
    void fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => undefined);
  }
}

export function track(e: TrackEvent) {
  if (!enabled()) return;
  queue.push(e);
  if (queue.length >= MAX_BATCH) flush();
  else timer ??= setTimeout(flush, FLUSH_MS);
}

export const trackAction = (action: ActionKind, at?: { block?: string; storey?: number; stack?: number; kind?: LeadKind }) =>
  track({ type: 'action', action, ...at });

export function routeEvent(r: Route): TrackEvent {
  switch (r.view) {
    case 'overview':
    case 'garage':
      return { type: 'view', view: r.view };
    case 'outdoor':
      return { type: 'view', view: 'outdoor', spot: r.spot };
    case 'block':
      return { type: 'view', view: 'block', block: r.block };
    case 'floor':
      return { type: 'view', view: 'floor', block: r.block, storey: r.storey };
    case 'unit':
      return { type: 'view', view: 'unit', block: r.block, storey: r.storey, stack: r.stack, ...(r.spot ? { spot: r.spot } : {}) };
  }
}

export function startAnalytics(subscribe: (fn: (r: Route) => void) => void, initial: Route) {
  if (!enabled()) return;
  let last = '';
  const view = (r: Route) => {
    const e = routeEvent(r);
    const key = JSON.stringify(e);
    // Navigating to where the visitor already is counts once.
    if (key !== last) track(e);
    last = key;
  };
  view(initial);
  subscribe(view);
  addEventListener('pagehide', () => flush(true));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush(true));
}
