/**
 * Entry point: Express app + HTTP server + WebSocket hub.
 *
 *   Development : `npm run dev`  (API on :3001, Vite client on :5173 proxies here)
 *   Production  : `npm run build` in client/, then `npm start` serves the
 *                 built client from this server on :3001.
 */
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import alertsRouter from './routes/alerts.js';
import profileRouter from './routes/profile.js';
import dispatchRouter from './routes/dispatch.js';
import { attachWs, clientCount } from './ws-hub.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

const app = express();
const server = http.createServer(app);

attachWs(server);

app.use(express.json({ limit: '256kb' }));

// Lightweight request log for the prototype (replace with pino/morgan in prod).
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

app.get('/api/health', (req, res) => {
  res.json({ ok: true, serverTime: new Date().toISOString(), wsClients: clientCount() });
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

// Serve the built client when available (single-server production mode).
const distDir = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sentinel panic-button API listening on http://0.0.0.0:${PORT}`);
  console.log(`WebSocket hub available at ws://0.0.0.0:${PORT}/ws`);
});
