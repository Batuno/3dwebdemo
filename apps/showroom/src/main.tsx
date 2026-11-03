import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { projectConfig } from '@bair/project-data';

document.documentElement.style.setProperty('--accent', projectConfig.brand.accent);
document.documentElement.style.setProperty('--accent-hover', projectConfig.brand.accentHover);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
