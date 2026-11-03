// Finds out which renders exist. A missing or broken manifest simply means real-time everywhere.
import { parseRenderManifest, projectConfig, type RenderManifest } from '@bair/project-data';

const manifestPath = (): string => {
  // Dev pages can point at test renders with ?manifest=...
  const override = import.meta.env.DEV ? new URLSearchParams(location.search).get('manifest') : null;
  return override ?? projectConfig.renderManifestUrl;
};

const baseUrl = (): string => projectConfig.assetBaseUrl || import.meta.env.BASE_URL;

/** The folder render paths are relative to. */
export const rendersBase = (): string => `${baseUrl()}${manifestPath().replace(/[^/]*$/, '')}`;

export async function loadRenderManifest(): Promise<RenderManifest | null> {
  try {
    const res = await fetch(`${baseUrl()}${manifestPath()}`);
    if (!res.ok) return null;
    return parseRenderManifest(await res.json());
  } catch {
    return null;
  }
}
