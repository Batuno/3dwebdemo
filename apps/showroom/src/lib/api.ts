import { projectConfig } from '@bair/project-data';

const base = projectConfig.api.url.replace(/\/$/, '');

/** True when the showroom was built with VITE_API_URL, i.e. there is an admin server to talk to. */
export const apiEnabled = projectConfig.api.url !== '';
export const apiUrl = (path: string): string => `${base}${path}`;
