import type { FacadePalette } from './types';

/** Everything a sales team changes for a new project lives here. */
export const projectConfig = {
  projectName: 'Oak Ville @ AMK',
  developerName: 'Таны Компани',
  developerLogoInitials: 'ТК',
  brand: {
    accent: '#0f6b5c',
    accentHover: '#0c5a4d',
  },
  contact: {
    phone: '+97670000000',
    phoneLabel: '7000-0000',
    messenger: 'https://m.me/your-page',
    address: 'Улаанбаатар хот (демо хаяг)',
  },
  /** Underground parking bay add-on. */
  bayPrice: 35_000_000,
  pricing: {
    /** NSO Mongolia, average new-apartment price in Ulaanbaatar, Aug 2026. */
    pricePerM2: 4_770_000,
    /** Per storey above storey 2. */
    floorPremium: 0.004,
  },
  availability: {
    seed: 'oakville-demo-2026',
    available: 0.6,
    reserved: 0.15,
    sold: 0.25,
  },
  /**
   * The admin panel's server (apps/api): leads, live statuses and prices, visit statistics. Set VITE_API_URL
   * when building: "/" when the server also serves the sites, or its full address. Empty means no server:
   * leads stay in the browser and statuses come from this file.
   */
  api: {
    url: (import.meta.env?.VITE_API_URL as string | undefined) ?? '',
  },
  leads: {
    /** Another backend for leads, instead of the API above. Empty uses the API (or the browser only). */
    endpoint: '',
  },
  /** Drives the real sun position. Oak Ville @ AMK, editable per project. */
  location: { latitude: 1.37, longitude: 103.84 },
  timeZone: 'Asia/Singapore',
  /** Heavy assets can move to a CDN later without code changes. */
  assetBaseUrl: import.meta.env?.VITE_ASSET_BASE_URL ?? '',
  renderManifestUrl: 'renders/manifest.json',
  /** A modelled surroundings file (see docs/BLENDER_PIPELINE.md). Empty uses generated neighbours. */
  context: {
    url: (import.meta.env?.VITE_CONTEXT_URL as string | undefined) ?? '',
    position: [0, 0, 0] as [number, number, number],
    rotationDeg: 0,
    attribution: '© OpenStreetMap contributors',
  },
  /** What the Unreal pipeline renders: panoramas at these clock times, flats on this storey. */
  renders: {
    times: ['07:00', '09:00', '12:00', '15:00', '17:30', '18:45', '21:00'],
    storey: 12,
  },
  quality: { default: 'auto' as 'auto' | 'high' | 'medium' | 'low' },
  blockLabelColors: { '804A': '#E2574C', '804B': '#3D7BE0' } as Record<string, string>,
  interior: { ceilingHeight: 2.6, wallInternal: 0.1, wallExternal: 0.2, skirting: 0.08 },
  facade: {
    panelLight: '#e6e4df',
    panelMid: '#bdb9b1',
    bronze: '#3d322b',
    warmAccent: '#8d7866',
    spandrelTeal: '#5d9fa3',
    gold: '#c9a35c',
    frame: '#2a2725',
    glassTint: '#9fd0cf',
  } satisfies FacadePalette,
} as const;

export type ProjectConfig = typeof projectConfig;
