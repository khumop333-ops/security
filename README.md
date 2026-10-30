# Sentinel Armed Response — Panic Button Application

A professional panic-button application for a private security company in
Pretoria, South Africa. Built for reliability, speed and clarity in emergency
situations — corporate visual language, no decoration, large tap targets.

> **Branding note:** "Sentinel Armed Response (Pty) Ltd" is a placeholder name
> and logo pending the company's final identity. Everything else is production-
> oriented.

---

## Contents

- [What is included](#what-is-included)
- [Screens](#screens)
- [Live deployment (Vercel)](#live-deployment-vercel)
- [Quick start](#quick-start)
- [Demo walkthrough](#demo-walkthrough)
- [Architecture](#architecture)
- [API overview](#api-overview)
- [Design system](#design-system)
- [POPIA compliance](#popia-compliance)
- [Production roadmap](#production-roadmap)

---

## What is included

| Deliverable | Where |
|---|---|
| Wireframes (6 app screens + dispatch console + design language) | [`docs/wireframes.html`](docs/wireframes.html) |
| Working prototype: panic flow (trigger → confirm → send → status) | `client/` + `server/` |
| Clean, commented code | both workspaces, standard conventions |
| Admin/dispatch dashboard with incoming alerts on a map | `/dispatch` route (`client/src/screens/Dispatch.jsx`) |

**Core functionality**

1. **Panic button** — one large button, hold 3 seconds to activate (accidental-
   trigger protection), captures GPS + timestamp + user ID, sends to the
   dispatch API, shows "Alert Sent — Help is on the way", and offers a
   PIN-guarded false-alarm cancel.
2. **Profile & medical info** — name, surname, SA ID number, address,
   emergency contact(s), medical conditions/allergies, armed-response contract
   number.
3. **Live status screen** — Dispatch Notified → Responder En Route →
   Responder Arrived → Resolved, with ETA and responder unit, updated live.
4. **Location services** — GPS permission on first use, fallback to last-known
   location + manual address entry, detected address shown for confirmation.
5. **Emergency contacts** — up to 3, notified with a location link on panic
   (simulated SMS/WhatsApp gateway in the prototype).
6. **History log** — clean list of past alerts with date, time, type and
   resolution status; tap for full audit detail.
7. **Settings** — edit profile, change PIN, notification preferences, test
   alert (no responders dispatched), POPIA data-subject requests.

## Screens

- `/` — Home / Panic (location confirmation + hold-to-activate button)
- `/status/:id` — Live status (also `/status` for the active alert)
- `/history` — Alert history
- `/profile` — Profile, medical info, emergency contacts, POPIA consent
- `/settings` — PIN, notifications, test alert, privacy requests
- `/dispatch` — Control-room dispatch console (desktop layout, live map)

## Live deployment (Vercel)

**URL:** <https://sentinel-armed-response.vercel.app>

| Piece | Where it runs |
|---|---|
| React client (static build) | Vercel CDN (`client/dist`) |
| API (Express serverless function) | Vercel Functions, Frankfurt region (`fra1`) — closest available to South Africa |
| Database | Supabase Postgres (project `fxedufukvxsuaqhxkdad`, eu-west-1), dedicated role `sentinel_app` |
| Live updates | Polling fallback (Vercel has no WebSockets) — the status screen reports "Polling" honestly |

Configuration lives in `vercel.json` (build command, output directory, `/api`
and SPA rewrites, function sizing/region) and the Vercel project's
`DATABASE_URL` environment variable. Storage is selected automatically in
`server/src/db.js`: Postgres when `DATABASE_URL` is set, SQLite otherwise.

Deployment notes learned while building this:

- Supabase's direct connection host (`db.<ref>.supabase.co`) is **IPv6-only**;
  Vercel functions cannot resolve it. Use the shared pooler
  (`aws-0-<region>.pooler.supabase.com:6543`) with the username format
  `<role>.<project-ref>` for custom roles.
- Pushing to the connected GitHub repository builds automatically; production
  deployments are created explicitly from the branch/commit to be promoted.

## Quick start

Requirements: **Node.js ≥ 22.5** (uses the built-in `node:sqlite` module).

```bash
npm install          # installs both workspaces
npm run dev:server   # terminal 1 — API + WebSocket on :3001
npm run dev:client   # terminal 2 — Vite dev server on :5173
```

Open <http://localhost:5173>. The Vite server proxies `/api` and `/ws` to the
backend, so the browser only talks to one origin.

**Production-style single server:**

```bash
npm run build        # builds the client into client/dist
npm start            # serves API + client on :3001
```

The SQLite database is created and seeded on first run at
`server/data/panic.db` (git-ignored). The demo PIN is **1234** — change it in
Settings.

## Demo walkthrough

1. **Panic flow (client):** open the home screen, watch the location strip
   confirm your position (or use "Enter address" if GPS is denied — browsers
   in sandboxed previews often block geolocation, the fallbacks handle this),
   then **press and hold the red button for 3 seconds**. Release early to
   cancel. On success you land on the live status screen.
2. **Dispatch flow (control room):** open `/dispatch` (header link). The alert
   appears in the queue instantly with the client's location on the map.
   Set an ETA and responder unit, then step through *en route → arrived →
   resolve*. The client's status screen updates live (WebSocket, with polling
   fallback).
3. **False alarm:** on the status screen tap *Cancel alert*, pick a reason and
   enter the PIN (1234). Dispatch sees the cancellation in the audit log.
4. **Test alert:** Settings → *Send test alert*. It is recorded and shown as a
   test — no responders are dispatched.
5. **Simulate an alert:** the dispatch console has a *Simulate alert* button so
   the control-room flow can be exercised without a second device.

## Architecture

```
security/
├── docs/wireframes.html        Deliverable 1 — wireframes + design language
├── server/                     Node.js + Express + ws
│   └── src/
│       ├── index.js            App bootstrap, static hosting of client/dist
│       ├── db.js               SQLite schema, queries, PIN hashing, seeding
│       ├── ws-hub.js           WebSocket broadcast hub (/ws)
│       └── routes/
│           ├── alerts.js       Panic/test alerts, history, PIN cancel
│           ├── profile.js      Profile, contacts, PIN change, POPIA requests
│           └── dispatch.js     Control-room queue, status transitions, simulate
└── client/                     React 18 + Vite (mobile-first)
    └── src/
        ├── screens/            Home, StatusScreen, History, Profile, Settings, Dispatch
        ├── components/         AppShell, PanicButton (hold logic), PinModal, Logo
        ├── lib/                api.js, live.js (WS + polling fallback), geo.js, format.js
        └── styles/global.css   Design tokens and components
```

**Real-time:** status changes broadcast over WebSocket (`/ws`). Clients that
cannot hold a WebSocket open automatically fall back to polling every 5 s —
the UI reports which mode is active.

**State machine (alerts):**

```
dispatch_notified → responder_en_route → responder_arrived → resolved
        └───────────────┴──────────────┴────────────→ cancelled (PIN or control room)
test alert → test_complete (terminal, no responders)
```

Invalid transitions are rejected with HTTP 409 and recorded in
`alert_events` (append-only audit log: actor, from → to, note, timestamp).

## API overview

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness + WebSocket client count |
| GET/PUT | `/api/profile` | Profile + emergency contacts (max 3) |
| POST | `/api/pin/verify` | Verify PIN (scrypt-hashed) |
| PUT | `/api/pin` | Change PIN (current PIN required) |
| POST | `/api/privacy/requests` | POPIA access/correction/deletion request |
| POST | `/api/alerts` | Create panic/test alert (409 if one is active) |
| GET | `/api/alerts` | History (paged) |
| GET | `/api/alerts/active` | Current active alert |
| GET | `/api/alerts/:id` | Alert + event log |
| POST | `/api/alerts/:id/cancel` | Cancel with PIN + reason |
| GET | `/api/dispatch/alerts` | Dispatch queue (`?filter=active|test`) |
| POST | `/api/dispatch/alerts/:id/status` | Advance status (en route/arrived/resolve) |
| POST | `/api/dispatch/simulate` | Generate a demo alert (Pretoria area) |

## Design system

Defined in `client/src/styles/global.css` (tokens at `:root`):

- **Primary** `#1C2B45` deep navy · **Alert** `#B3261E` matte red — *panic
  button only* · **Background** `#F5F5F3` · **Text** `#1A1A1A` /
  `#FFFFFF` · **Resolved** `#2E6B4F` muted green.
- Inter (bundled via `@fontsource/inter`, weights 400/500/600/700). Hierarchy
  through weight, not colour.
- No gradients / neon / glassmorphism / decorative animation / emoji. Outline
  icons (lucide, stroke 1.75). Elevation ≤ 2 px shadow.
- Button states use shade variation (see wireframes §1). Tap targets ≥ 48 px,
  body text ≥ 16 px, WCAG AA contrast throughout.
- Dates display as `dd/mm/yyyy` 24-hour (`en-ZA`, `Africa/Johannesburg`).

## POPIA compliance

South Africa's Protection of Personal Information Act 4 of 2013 is treated as
a first-class requirement:

- **Consent** is captured explicitly (profile screen) and stored with a
  timestamp (`popia_consent`, `popia_consent_at`).
- **Purpose limitation:** location is captured only when an alert is triggered
  or a test is run; medical information is visible only to responders and the
  control room.
- **Data-subject rights:** access / correction / deletion requests are built
  into Settings and logged to `data_requests` (information officer follows up
  within the statutory 30 days).
- **Security:** PINs are stored as scrypt hashes; the prototype keeps all data
  in one local database file with no third-party sharing.
- A full privacy notice is shown in-app (Settings → Privacy) and mirrored in
  `client/src/lib/format.js` (`POPIA_NOTICE`).

## Production roadmap

The prototype deliberately leaves these as integration points (marked in the
code):

1. **Database** — the PostgreSQL driver (`server/src/db-pg.js`) is production-
   ready and used on Vercel; for self-hosted deployments point `DATABASE_URL`
   at any Postgres 14+ (the schema maps 1:1 to the SQLite version).
2. **Notifications** — replace the simulated gateway in `db.js`/`StatusScreen`
   with an SMS/WhatsApp provider (e.g. BulkSMS, Clickatell, Twilio) and push
   via Firebase Cloud Messaging.
3. **Dispatch authentication** — operator login (JWT + roles) in front of
   `routes/dispatch.js`, plus a full audit export.
4. **Mobile** — the client is a mobile-first web app (installable as a PWA);
   port to React Native for store distribution using the same API. Native
   geolocation + background location improve reliability.
5. **Hosting** — the live demo runs on Vercel (functions in `fra1`, Frankfurt)
   with Supabase Postgres in `eu-west-1`; for full POPIA data residency,
   self-host in South Africa (e.g. AWS `af-south-1` Cape Town) with TLS
   everywhere and a WAF in front of the dispatch console.
6. **Reverse geocoding** — self-host Nominatim or use a commercial provider;
   the current browser-side lookup is best-effort and degrades to coordinates
   plus manual address entry.

## Licence

Proprietary — prepared for the client. Third-party assets: Inter font (OFL),
lucide icons (ISC), OpenStreetMap map data (ODbL, tile usage per OSM policy).
