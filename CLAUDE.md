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
```

### Backend (`/backend`)
```bash
npm run dev       # Dev server with nodemon (port 5000)
npm start         # Production server
npm test          # Run tests (Vitest + Supertest)
npm run test:watch
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
