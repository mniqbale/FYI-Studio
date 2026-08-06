---
id: sprint-010-issue-1005
title: "Issue 10.5 — Ingestion E2E + Quota Verification"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-010, issue-1005, e2e, ingestion, quota, verification, typecheck, build]
related_documents:
  - "README.md"
  - "platform-analytics-architecture.md"
  - "platform-analytics-stack-proposal.md"
  - "Issue-1001.md"
  - "Issue-1002.md"
  - "Issue-1003.md"
  - "Issue-1004.md"
related_sprint: "Sprint-010"
---

# Issue 10.5 — Ingestion E2E + Quota Verification

> **Sprint:** 10 (Milestone 11: Platform Analytics & Revenue)  
> **Estimate:** S (1-2 hours)  
> **Dependencies:** Issues 10.1-10.4 (all ingestion components complete)  
> **Blockers:** None

---

## 1. Objective

Perform end-to-end verification of the analytics ingestion pipeline:
1. Seed a published YouTube video (mock or real).
2. Run the ingestion worker (mock YouTube adapter) → upsert local tables.
3. Verify idempotency (re-run produces no duplicates).
4. Verify memory feedback + Dashboard reads local tables only.
5. Run `pnpm run typecheck` + `pnpm run build` + tests.

---

## 2. Deliverables

### 2.1 Mock YouTube adapter (for E2E without consuming real quota)

```typescript
// services/analytics-ingest/src/utils/youtube.mock.ts
export async function fetchVideoStats(_apiKey: string, _videoId: string) {
  return { views: 1000, likes: 50, comments: 10 };   // deterministic mock
}
export async function fetchVideoRevenue(_token: string, _channelId: string, _videoId: string) {
  return 12.34;   // deterministic mock revenue
}
```

### 2.2 E2E test: `tests/e2e/analytics-ingest.test.ts`

```typescript
// tests/e2e/analytics-ingest.test.ts
import { describe, it, expect } from 'vitest';
import { prisma } from '@fyi/database';
import { runIngestionCycle } from '../../services/analytics-ingest/src/ingest.js';

describe('Analytics Ingestion E2E', () => {
  it('ingests stats + revenue idempotently and writes memory', async () => {
    // Seed a published video
    await prisma.scheduledPublish.create({ data: { tenantId: 't1', jobId: 'job-1', socialAccountId: 'acc-1', status: 'published', scheduledAt: new Date(), platformResponse: { videoId: 'vid-1' } } });

    // Run twice — must be idempotent
    await runIngestionCycle();
    await runIngestionCycle();

    const metrics = await prisma.platformMetric.findMany({ where: { videoId: 'vid-1' } });
    const revenue = await prisma.videoRevenue.findMany({ where: { videoId: 'vid-1' } });
    const memory = await prisma.memoryEntry.findMany({ where: { kind: 'analytics' } });

    // No duplicate rows despite running twice
    expect(metrics).toHaveLength(1);
    expect(metrics[0].views).toBe(1000);
    expect(revenue).toHaveLength(1);
    expect(memory.length).toBeGreaterThan(0);
  });
});
```

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Ingestion upserts stats + revenue (mock adapter) | E2E passes |
| 2 | Re-run is idempotent (no duplicates) | E2E: run twice, 1 row each |
| 3 | Memory feedback written | E2E: `memory_entries` kind: analytics |
| 4 | Dashboard reads local tables only (no platform API) | Code review + E2E guard |
| 5 | Quota ledger respected | Unit test + E2E |
| 6 | `pnpm run typecheck` + `pnpm run build` pass | CI check |
| 7 | Unit tests for ingest + quota (≥80% coverage) | `pnpm test` |

---

## 4. Implementation Notes

- **Mock first** — run the E2E with the mock adapter to avoid consuming real YouTube quota during tests.
- **Idempotency proof** — the E2E runs the cycle twice and asserts no duplicate rows (core of ADR-0009 reliability).

---

## 5. Definition of Done

- [ ] E2E ingestion flow passes with mock adapter
- [ ] Idempotency verified
- [ ] Memory feedback verified
- [ ] Typecheck/build pass; unit tests ≥80%

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [platform-analytics-architecture.md](../architecture/platform-analytics-architecture.md)
- **ADR-0009 (ingestion + quota + idempotency):** [../../adr/ADR-0009-platform-analytics-ingestion.md](../../adr/ADR-0009-platform-analytics-ingestion.md)
