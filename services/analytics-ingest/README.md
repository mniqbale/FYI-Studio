# FYI Studio Analytics Ingestion Service (Milestone 11 / Sprint 10)

Scheduled YouTube platform analytics + revenue ingestion pipeline (ADR-0009).

## What it does

- A **BullMQ repeatable job** runs on a configurable cadence (`INGEST_INTERVAL_MS`,
  default daily) and ingests YouTube stats (views, likes, comments, watch time)
  + revenue per published video into **local PostgreSQL tables**.
- Runs under a strict **quota ledger** (10,000 units/day, **shared with uploads**,
  ADR-0008). It checks remaining units before each run and defers if a run would
  exceed the daily budget.
- Idempotently upserts `PlatformMetric` (keyed by `video_id + platform +
  snapshot_date`) and `VideoRevenue` (keyed by `video_id + platform + period`).
- Writes an `AnalyticsIngestionLog` run record for observability/quota accounting.
- Writes a single coalesced `memory_entries` row (`kind: analytics`) per successful
  cycle so the Memory Layer can reflect on performance.

## Hard constraint (ADR-0009)

The **Dashboard NEVER calls a platform API on page load**. All platform API calls
happen here (the scheduled cron worker) and write to local tables. The Dashboard
only `SELECT`s from `platform_metrics` / `video_revenue`.

## Real vs mock adapter

- A real YouTube Data API v3 + YouTube Analytics API client is implemented
  (`src/utils/youtube.ts`) behind the `YoutubeClient` interface.
- It is selected ONLY when `YOUTUBE_API_KEY_REF` is set (an API key / OAuth token is
  present). Otherwise a **mock adapter** returns deterministic, plausible stats +
  revenue for any video id — used for tests, E2E, and local development.

## Run

```bash
# from repo root
pnpm analytics:ingest            # start the repeatable ingestion worker
pnpm analytics:ingest:seed       # seed a published video for the E2E/ingestion
pnpm analytics:ingest:once       # run one ingestion cycle immediately, then exit
```

## Environment

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/fyi_studio
REDIS_URL=redis://localhost:6379
YOUTUBE_API_KEY_REF=             # set to use the REAL adapter; leave empty for mock
QUOTA_LIMIT=10000                # daily YouTube API units (shared with uploads)
INGEST_INTERVAL_MS=86400000      # ingestion cadence (ms); 1 day
LOG_LEVEL=info
```

## Tests

```bash
pnpm --filter @fyi/analytics-ingest test    # unit tests (quota, ingest, youtube)
pnpm analytics:ingest:e2e                   # mock-adapter E2E against live Postgres/Redis
```

## Structure

```
src/
├── index.ts          # entrypoint: start BullMQ repeatable worker (or --once)
├── scheduler.ts      # BullMQ repeatable job registration
├── ingest.ts         # fetch stats+revenue -> idempotent upserts
├── revenue.ts        # per-video revenue fetch/upsert
├── quota.ts          # quota ledger: check/record/used-units
└── utils/
    ├── prisma.ts     # Prisma singleton + env loader
    ├── youtube.ts    # YouTube Data API v3 + Analytics API client (real + mock)
    ├── memory.ts     # write memory_entries (kind: analytics)
    └── videos.ts     # discover published videos to ingest
```
