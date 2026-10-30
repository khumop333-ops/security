/**
 * Vercel serverless function entry point.
 *
 * All /api/* requests are rewritten to this function (see vercel.json) and
 * handled by the same Express app used locally. Storage is Postgres when
 * DATABASE_URL is set (server/src/db.js selects the driver).
 *
 * WebSocket push is not available on Vercel — clients fall back to polling
 * the REST API (client/src/lib/live.js).
 */
import { createApp } from '../server/src/app.js';

const app = createApp();

export default function handler(req, res) {
  return app(req, res);
}
