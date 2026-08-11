# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (`/frontend`)
```bash
npm run dev       # Dev server on port 3000 (Vite)
npm run build     # Production build
npm run test      # Run tests (Vitest)
npm run lint      # ESLint
npm run format    # Prettier
npm run check     # Prettier write + ESLint fix (combined)
npm run audit     # Same audit gate CI runs
npm run lock      # Regenerate package-lock.json in a Linux container
```

### Backend (`/backend`)
```bash
npm run dev       # Dev server with nodemon (port 5000)
npm start         # Production server
npm test          # Run tests (Vitest + Supertest)
npm run test:watch
npm run audit     # Same audit gate CI runs
npm run lock      # Regenerate package-lock.json in a Linux container
```

### Infrastructure
```bash
docker compose up -d              # Start production stack
docker compose -f compose.dev.yaml up -d  # Start dev stack
```

## Architecture

This is a full-stack internal tool for **Gen7 Fuel** covering fuel invoicing, personnel, assets, credentials, subscriptions, and access control.

**Request flow**: Caddy (port 3500) → serves frontend SPA from `/srv`, proxies `/api*` to Express backend (port 5000) → MongoDB.

### Frontend
- **React 19** SPA, built with **Vite 7**
- **TanStack Router** (file-based routing) + **TanStack React Query** (server state)
- **Tailwind CSS 4** + **Shadcn/ui** (Radix primitives) for UI
- Path alias: `@/*` → `src/*`

**Routing conventions** in `src/routes/`:
- `_appbar.tsx` / `_appbar/` — authenticated layout with top app bar
- `_sidebar/` — nested layout with sidebar nav
- `(auth)/` — auth group (login, etc.)

**API clients** live in `src/lib/` — one file per domain (e.g. `cdn-api.ts`, `credential-api.ts`, `fuel-invoicing/`).

### Backend
- **Express 5** on Node 25, **Mongoose 9** for MongoDB
- JWT authentication via `middleware/auth.js`; rate limiting on `/auth` and `/seed` endpoints
- Feature domains under `apps/`: `auth`, `users`, `roles`, `personnel`, `credentials`, `assets`, `access`, `fuel-invoicing`, `subscriptions`, `cipher`, `inventory`, `sage`
- Each domain has `*.model.js` + `*.routes.js`; tests co-located as `*.routes.test.js`
- Health check endpoint: `GET /api/health`

### CI/CD
- GitHub Actions: `.github/workflows/ci.yml` runs frontend lint/build + backend tests on PRs
- `.github/workflows/deploy.yml` SSH-deploys to production server

## Dependency audits

CI runs `node scripts/audit-ci.mjs <workspace>` instead of a bare
`npm audit --audit-level=high`. It fails on any high/critical advisory that is
**not** in the `ALLOWLIST` at the top of `scripts/audit-ci.mjs`. Reproduce a CI
audit failure locally with `npm run audit` in `frontend/` or `backend/`.

The allowlist is keyed by **GHSA id**, not package name, so a new advisory
against an already-allowlisted package still fails the build.

### When the audit fails

Work down this list — do not skip to the bottom:

1. **Check whether the flagged version is actually vulnerable.** Advisory
   ranges are sometimes written too broadly and sweep in patched maintenance
   releases. Open the installed copy in `node_modules` and look for the fix.
   This is not hypothetical: `brace-expansion` was allowlisted on exactly these
   grounds until the advisory range was corrected upstream and the entry was
   dropped. Conversely, `nanoid@3.3.16` looked similar but the installed copy
   genuinely lacked the fix, so it was bumped rather than suppressed.
2. **Fix it for real** if a compatible version exists: bump the direct
   dependency, or add a bounded `overrides` entry in that workspace's
   `package.json`.
3. **Only then** add a GHSA id to `ALLOWLIST` with a written reason. If you
   cannot articulate why it is not actionable, it is actionable.

After any dependency change run `npm run lock` (Docker, Linux `node:22`) — never
commit a lockfile generated on Windows, it drifts on platform-specific optional
deps.

### Do not "fix" audits with unbounded overrides

`npm audit fix --force` and open-ended override targets are how this repo gets
broken. Two concrete traps:

- **Unbounded target ranges jump majors.** `"brace-expansion@1": ">=1.1.18"`
  resolves to **5.0.9**, because 5.0.9 satisfies `>=1.1.18`. Always bound the
  target: `"brace-expansion@1": "^1.1.18"`.
- **A green audit can mean broken code.** Forcing
  `"brace-expansion": "^5.0.9"` makes `npm audit` report zero
  vulnerabilities *and* breaks the app: 5.x changed the CommonJS export from a
  callable `module.exports = expandTop` to a named `exports.expand`, so
  minimatch 3.x/5.x throws `expand is not a function`.

### Current allowlist entries

| GHSA | Package | Why |
|------|---------|-----|
| `GHSA-4r6h-8v6p-xvw6` | `xlsx` | Prototype pollution in SheetJS; no fixed version published on npm (range `*`). |
| `GHSA-5pgg-2g8v-p4x9` | `xlsx` | ReDoS in SheetJS; same, no fix published. |

Running the full gate (`node scripts/audit-ci.mjs` with no argument) also
reports allowlist entries that no longer match anything, so stale suppressions
get removed rather than silently hiding future advisories.

## Hub Integration

Desk's "Hub" pages (`frontend/src/routes/_appbar/_sidebar/hub/`) call the Hub app (`https://app.gen7fuel.com`) directly from the browser using a short-lived external token embedded in the Desk JWT.

### Auth mechanism
- `frontend/src/lib/permissions.ts` → `getTokenPayload()` returns the decoded Desk JWT.
- The JWT contains an `externalToken` field issued by Hub.
- Hub calls use `Authorization: Bearer <externalToken>` — never the Desk JWT directly.
- Helper `getExternalToken()` is defined inline in each hub page to extract this field.

### Hub backend structure (`thehub/backend/`)
```
backend/
├── app.js                  # Entry point; registers all routes + middleware
├── middleware/
│   └── authMiddleware.js   # auth (HTTP) + authSocket (Socket.IO)
├── models/                 # Mongoose schemas (one file per entity)
│   ├── CashRec.js              – KardpollReport + BankStatement schemas
│   ├── CashSummaryNew.js       – Daily cash summary totals
│   ├── CashRecTag.js           – Per-site holiday/day tags (site, date)
│   ├── Location.js             – Store locations + sageEntityKey
│   ├── Transactions.js         – POS receivables
│   └── ...
├── routes/                 # Express routers (one file per feature)
│   ├── cashRecRoutes.js        – /api/cash-rec/*
│   ├── cashSummaryNewRoutes.js
│   └── ...
├── services/               # Business logic separated from routes
├── cron_jobs/              # Scheduled tasks (weekly AR report, etc.)
├── queues/                 # BullMQ email queue (backed by Redis)
└── utils/                  # Shared helpers (PDF generation, number parsing)
```

Routes mounted **before** `app.use(auth)` in Hub's `app.js` are public; everything after requires a valid token.

### Hub endpoints used by Desk

| Method | Path | Used in |
|--------|------|---------|
| GET | `/api/cash-rec/entries?site=&date=` | cash-management — main data fetch (single day) |
| GET | `/api/cash-rec/tags?site=&startDate=&endDate=` | cash-management — holiday tag lookup |
| POST | `/api/cash-rec/tags` | cash-management — mark day as holiday |
| DELETE | `/api/cash-rec/tags?site=&date=` | cash-management — remove holiday tag |
| GET | `/api/cash-rec/kardpoll-entries?site=&date=` | cash-management — AR rows for Sage receipt |
| GET | `/api/locations` | cash-management + SitePicker — location list + sageEntityKey |
| GET | `/api/purchase-orders?startDate=&endDate=&stationName=` | cash-management — AR PO rows for Sage receipt |

### Key constants (Desk frontend)
```ts
const HUB = 'https://app.gen7fuel.com'  // defined at top of each hub page
```
