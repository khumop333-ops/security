import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies API and WebSocket traffic to the Express backend so
// the browser always talks to a single origin (see server/src/index.js).
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Allow the proxied preview host (and any host) during development.
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3001', ws: true }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3001', ws: true }
    }
  }
});
