# BSC Enterprise Operations Platform

Production-ready **Wedding Customer Follow-up CRM + HRMS + Store Operations** platform for
BSC EXCLUSIVE's three locations — **Belagavi, Davanagere, Shivamogga** — with strict
branch-level data isolation, JWT authentication, AES-256-GCM encryption at rest and a
role-governed admin dashboard.

## Repository Structure (frontend / backend / database)

```
BSC_SMG_CRM/
├── index.js                  # Hostinger/Passenger entry — bootstraps backend/index.js
├── package.json              # root scripts: start, build, test, seed
├── frontend/                 # React 18 + TypeScript + Vite + Tailwind SPA
│   ├── src/
│   │   ├── components/       # UI library + DevToolsGuard, ErrorBoundary, ConnectivityBanner
│   │   ├── pages/            # Dashboard, WeddingCRM, Candidates, Settings, …
│   │   └── services/api.ts   # typed API client + session management
│   └── vite.config.ts        # vendor chunk splitting for fast loads
├── backend/
│   ├── index.js              # Express app: REST API + static SPA + Socket.IO
│   ├── build.js              # builds frontend → backend/dist (+ root mirror)
│   └── src/
│       ├── config/           # MySQL pool + self-healing DB initializer
│       ├── controllers/      # HTTP layer (auth, wedding CRM, candidates, …)
│       ├── services/         # business logic (authService, …)
│       ├── routes/           # /api/v1, legacy /api, wedding routes
│       ├── middleware/       # JWT auth (authenticate/authorize/location filter), uploads
│       ├── utils/            # crypto (AES-256-GCM), csv, secrets, logger, response
│       ├── validators/       # input validation
│       └── scripts/          # seed & migration helpers
├── database/                 # SQL schema, default data, roles, permissions, indexes
├── tests/
│   ├── unit/                 # pure-logic tests (csv, crypto, response, secrets)
│   ├── whitebox/             # internal logic with mocked DB pool (auth flows)
│   └── blackbox/             # live HTTP tests against a spawned server
└── dist/                     # deployable mirror of backend/dist
```

## Quick Start

```bash
# 1. Install & build (frontend + backend)
npm install

# 2. Configure the database (MySQL 8 / MariaDB)
cp backend/.env.production.example backend/.env
#    set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
#    optionally JWT_SECRET / ENCRYPTION_KEY (auto-generated & persisted if omitted)

# 3. Run
npm start                # serves API + SPA on $PORT (default 3000)
npm run build            # rebuild frontend + refresh dist
npm test                 # unit + white-box + black-box suites (node --test)
npm run seed             # seed default users/designations/questions
```

The database bootstraps itself on first boot (tables, indexes, seed users, performance
indexes). The app also boots gracefully with the database offline — health stays UP and
the UI surfaces friendly errors.

## Security Model

| Aspect | Implementation |
| --- | --- |
| Passwords | bcrypt hashes; legacy plaintext rows auto-upgrade on login |
| Master recovery | `admin@bsctextiles.com` / `admin@2026` — built-in accounts only |
| Sign-in captcha | Server-generated 4-digit numeric SVG; refreshes every 30 s; auto-reloads on wrong entry; verified server-side |
| Sessions | Server-managed httpOnly cookie + JWT with a per-deployment secret; **6-hour absolute auto-logout** (`SESSION_HOURS`); location claims come from the DB |
| Kiosk/cash PINs | Stored as bcrypt hashes, never displayed, no universal backdoor |
| Location isolation | Branch users only ever see their branch's rows — enforced in SQL |
| Encryption at rest | AES-256-GCM (`enc:v1:…`) for customer notes & call remarks |
| Endpoint guards | Admin-only maintenance routes; dispatcher auth whitelist |
| Brute force | 50 login attempts / 10 min / IP + mandatory captcha |
| Secrets | None in the frontend bundle — all keys live in `backend/.env` (gitignored) |
| DevTools shield | **Off by default** — Admin enables in Settings → Security; locks every device with a "turn off Developer Tools" screen and audits detections |
| Audit trail | Logins, logouts, failed attempts, GPS pings, CRM actions |

## Admin Dashboard

- Operational KPIs from live data (staff, feedback, footfall, diverts).
- **Authentication Activity** — sign-ins/sign-outs (today & 7 days), active users,
  last sign-in, and a timestamped event table with IP addresses.
- Security center — DevTools shield toggle + detection log with timestamps.
- GPS sign-in trail — devices report their location after login (permission-aware).

## Wedding Follow-up CRM

Calling desk (overdue / today / callbacks / upcoming), follow-up calendar, conversion
funnel & telecaller performance, **CSV bulk import** (strict validation — rows missing a
name, valid 10-digit mobile or shopping date are skipped and reported), **CSV / Excel /
PDF export**, and **WhatsApp / Email** actions per customer.

## Deployment (Hostinger / Passenger)

1. Upload the repository; set Passenger startup file to `index.js` (repo root).
2. `backend/.env` holds DB credentials & secrets (never committed).
3. `UPLOAD_DIR` should point to a persistent directory outside the app folder.
4. `npm run build` refreshes `backend/dist`; `tmp/restart.txt` signals Passenger.

## Testing

```bash
npm test     # 75 tests: unit (crypto/csv/response/secrets/captcha),
             # white-box (auth internals, CSV import validation, PIN hashing — mocked pool),
             # black-box (live HTTP: captcha flow, auth, guards, gzip, caching,
             #            rate limit, security endpoints, CSV import contracts)
```

## Complete User Manual

`BSC_Complete_User_Manual.pdf` (repo root, 20 pages) — the full walkthrough for every role:
sign-in with the security code, dashboard, Wedding CRM workflows (calling desk, CSV import,
exports, WhatsApp/e-mail), store operations, recruitment, administration, the security centre
and troubleshooting — with screenshots of every screen. Regenerate it after UI changes with
`docs/manual/build_manual.py` + `docs/manual/merge_manual.py`.
