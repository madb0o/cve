# CVE Monitoring Dashboard

A local web dashboard for tracking MITRE/NVD CVE data: publication trends
(daily/weekly/monthly/yearly), severity distribution, and vulnerability type
(RCE, privilege escalation, XSS, SQLi, etc.), all filterable by date range,
severity, and type.

## Architecture

- **server/** — Express + TypeScript API, backed by SQLite (Node's built-in
  `node:sqlite`, no native build step). Syncs CVE data from the
  [NVD CVE 2.0 API](https://nvd.nist.gov/developers/vulnerabilities).
- **client/** — React + Vite + TypeScript dashboard, charts via Recharts.
- In production, the Express server also serves the built client, so the
  whole app is a single process/port.

## Setup

```bash
npm install
cp server/.env.example server/.env
# edit server/.env and set NVD_API_KEY to your key from
# https://nvd.nist.gov/developers/request-an-api-key
```

## Backfilling CVE history

This project backfills the **full NVD history since 1999**. It's resumable —
if interrupted, re-running picks up where it left off (progress is stored in
the `sync_state` table).

```bash
npm run backfill
```

With an API key this takes on the order of minutes to tens of minutes,
depending on NVD's response times; it prints progress per 120-day window as
it goes.

After the initial backfill, the server keeps itself current automatically —
`SYNC_INTERVAL_HOURS` (default 6, set in `server/.env`) controls how often it
polls NVD for anything published or modified since the last sync. You can
also trigger a sync on demand from the dashboard's "Sync now" button, or via
`POST /api/sync/trigger`.

## Running locally

```bash
npm run dev
```

This starts the API on `http://localhost:4000` and the Vite dev server on
`http://localhost:5173` (proxying `/api` to the backend). Open
`http://localhost:5173`.

## Building / running in production mode

```bash
npm run build
npm start
```

Serves everything from `http://localhost:4000` (port configurable via `PORT`
in `server/.env`).

## Docker / VPS deployment

```bash
cp server/.env.example .env   # docker-compose reads NVD_API_KEY from repo-root .env
docker compose up -d --build
```

The SQLite database persists in a named Docker volume (`cve-data`), mounted
at `/app/server/data`. To backfill inside the container:

```bash
docker compose exec cve-dashboard npm run backfill
```

Put a reverse proxy (Caddy, Nginx, etc.) in front of port 4000 for TLS/domain
routing on a VPS.

## A note on "vulnerability type"

Neither MITRE nor NVD label CVEs as "RCE," "LPE," "XSS," etc. — that's derived
here from each CVE's CWE (weakness) ID(s) via a mapping table at
`server/src/nvd/cweCategories.json`. It's necessarily approximate (a CVE can
carry multiple CWEs, we take the first mapped match) and only covers common,
well-known CWEs — anything unmapped falls into "Other." The raw CWE IDs are
stored alongside the derived category (`cwe_ids` column) and the full API
response is kept too (`raw_json`), so the mapping can be refined later without
re-fetching data — just edit `cweCategories.json` and re-run
`npm run backfill` (upserts are idempotent, so this just re-classifies
existing records) or write a one-off reclassification script against the
stored `raw_json`.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/stats/summary` | KPI totals (all-time, this year/month/week/today, YoY delta) |
| `GET /api/stats/trend` | Time series, `granularity=daily\|weekly\|monthly\|yearly`, optional `groupBy=severity\|type` |
| `GET /api/stats/by-severity` | Counts by severity |
| `GET /api/stats/by-type` | Counts by derived vulnerability type (top N + Other) |
| `GET /api/cves` | Filtered/paginated CVE list |
| `GET /api/meta` | Available filter values, DB date range, last sync time |
| `POST /api/sync/trigger` | Manually trigger an incremental sync |

All of the above (except `/api/meta` and `/api/sync/trigger`) accept
`from`, `to` (ISO dates), `severity`, and `type` (comma-separated) query
params.
