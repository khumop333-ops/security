/**
 * Local/development entry point: Express app + HTTP server + WebSocket hub.
 *
 *   Development : `npm run dev`  (API on :3001, Vite client on :5173 proxies here)
 *   Production  : `npm run build` in client/, then `npm start` serves the
 *                 built client from this server on :3001.
 */
import http from 'node:http';

import { createApp } from './app.js';
import { attachWs } from './ws-hub.js';

const PORT = Number(process.env.PORT) || 3001;

const app = createApp();
const server = http.createServer(app);

// WebSocket live updates — only available in this long-running server.
// On Vercel the client falls back to polling (client/src/lib/live.js).
attachWs(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sentinel panic-button API listening on http://0.0.0.0:${PORT}`);
  console.log(`WebSocket hub available at ws://0.0.0.0:${PORT}/ws`);
});
