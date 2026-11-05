// Statuses and prices the sales team sets in the admin panel. Loaded at start and every two minutes while
// the page is visible; the browser revalidates with the ETag, so an unchanged copy costs a 304.
import { applyInventory, type InventorySnapshot } from '@bair/project-data';
import { useAppStore } from '../store/useAppStore';
import { apiEnabled, apiUrl } from './api';

const EVERY_MS = 120_000;

async function load() {
  try {
    const res = await fetch(apiUrl('/api/public/inventory'), { cache: 'no-cache' });
    if (!res.ok) return;
    if (applyInventory((await res.json()) as InventorySnapshot)) useAppStore.getState().bumpInventory();
  } catch {
    // Offline or no server: the statuses from project data stay.
  }
}

export function startLiveInventory() {
  if (!apiEnabled) return;
  void load();
  setInterval(() => document.visibilityState === 'visible' && void load(), EVERY_MS);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void load());
}
