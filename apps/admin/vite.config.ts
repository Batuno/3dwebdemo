/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Served at /admin/ next to the API, so the session cookie stays on one site. In dev, /api goes to the
// local API server (`pnpm dev:admin` starts both).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/admin/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    proxy: { '/api': { target: process.env.API_PROXY ?? 'http://localhost:8787', changeOrigin: false } },
  },
  build: { target: 'es2022' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
