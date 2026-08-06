# @fyi/dashboard

Read-only web Dashboard over the FYI Studio Job Ledger (Milestone 8 / Sprint 7).

## Run

```bash
# from repo root
pnpm install
pnpm run dashboard        # http://localhost:3001
pnpm run dashboard:dev    # watch mode (tsx)
```

## Verify

```bash
pnpm run dashboard:typecheck
pnpm run dashboard:build
curl http://localhost:3001/health
```

## Seed test data (for a visual demo / E2E)

```bash
pnpm tsx services/dashboard/scripts/seed-test-job.ts
```

## Pages

- `/` — Overview (jobs by status, cost, recent jobs)
- `/jobs` — paginated/filterable job list
- `/jobs/:id` — pipeline timeline + artifacts + video playback
- `/tenants` — tenant policy + spend vs quota
- `/analytics` — cost/token charts (Chart.js)
- `/media/<execution_id>/<file>` — media files (Range requests supported)

Read-only: this service never writes to the Job Ledger.
