/**
 * Shared Express app builder.
 *
 * Used by both:
 *   - server/src/index.js  (local/dev: adds WebSockets + static hosting + listen)
 *   - api/index.js         (Vercel serverless function handler)
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import alertsRouter from './routes/alerts.js';
import profileRouter from './routes/profile.js';
import dispatchRouter from './routes/dispatch.js';
import { diagnose } from './db.js';
import { clientCount } from './ws-hub.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '256kb' }));

  // Lightweight request log (replace with pino/morgan in production).
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (req.path.startsWith('/api')) {
        console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
      }
    });
    next();
  });

  // Same-origin in dev (via Vite proxy), but allow direct API access during testing.
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });

  app.get('/api/health', async (req, res) => {
    // Includes a DB diagnosis (driver, connectivity, schema init) so
    // deployment health can be verified externally in one request.
    let db = { driver: 'unknown' };
    try {
      db = await diagnose();
    } catch (err) {
      db = { driver: 'unknown', error: err.message };
    }
    res.json({ ok: true, serverTime: new Date().toISOString(), wsClients: clientCount(), db });
  });

  app.use('/api', profileRouter);
  app.use('/api', alertsRouter);
  app.use('/api', dispatchRouter);

  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown API endpoint.' } });
    }
    return next();
  });

  // Serve the built client in local single-server mode. On Vercel, static
  // files are served by the CDN from the build output directory instead.
  const distDir = path.join(__dirname, '..', '..', 'client', 'dist');
  if (!process.env.VERCEL && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }

  // Central error handler — always answer with the JSON error envelope.
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error(err);
    res.status(err.statusCode || 500).json({
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Unexpected server error.' }
    });
  });

  return app;
}

export default createApp;
