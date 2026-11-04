// Phones (the low tier) load half-resolution textures and image lights, made at build time from the
// same files (vite.config.ts). Decided once at start-up: a tier change later keeps what is loaded.
import { projectConfig } from '@bair/project-data';
import { useAppStore } from '../store/useAppStore';

export const liteAssets = useAppStore.getState().quality === 'low' && !projectConfig.assetBaseUrl;

/** "textures/x.ktx2" → "textures/lite/x.ktx2" on phones. */
export const tiered = (p: string): string => (liteAssets ? p.replace(/^(textures|hdri)\//, '$1/lite/') : p);
