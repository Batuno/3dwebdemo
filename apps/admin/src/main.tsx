import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { projectConfig } from '@bair/project-data';
import './index.css';
import { App } from './App';

// The project's brand colour leads in light mode; dark mode keeps its own lighter step from index.css.
if (!matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.style.setProperty('--accent', projectConfig.brand.accent);
  document.documentElement.style.setProperty('--accent-hover', projectConfig.brand.accentHover);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
