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
  // Vercel compiles the /api/:path* rewrite to `/api/index?path=:path*`.
  // Restore the original RESTful URL so the shared Express router matches
  // normally. If no `path` parameter is present, the URL is already original.
  try {
    const url = new URL(req.url, 'http://internal');
    const rest = url.searchParams.get('path');
    if (rest !== null) {
      url.searchParams.delete('path');
      const qs = url.searchParams.toString();
      req.url = `/api/${rest}${qs ? `?${qs}` : ''}`;
    }
  } catch {
    /* fall through with the URL untouched */
  }
  return app(req, res);
}
