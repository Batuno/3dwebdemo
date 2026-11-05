import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { projectConfig } from '@bair/project-data';
import { startAnalytics } from './lib/analytics';
import { retryPendingLeads } from './lib/leads';
import { startLiveInventory } from './lib/liveInventory';
import { useAppStore } from './store/useAppStore';

document.documentElement.style.setProperty('--accent', projectConfig.brand.accent);
document.documentElement.style.setProperty('--accent-hover', projectConfig.brand.accentHover);

// Live statuses and prices, anonymous visit statistics and leads that failed to send earlier: all need the
// admin server (VITE_API_URL) and do nothing without one. The dev pages are left out of the statistics.
if (!location.hash.startsWith('#/dev')) {
  startLiveInventory();
  startAnalytics((fn) => useAppStore.subscribe((s, prev) => s.route !== prev.route && fn(s.route)), useAppStore.getState().route);
  void retryPendingLeads();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
