---
id: sprint-009-issue-905
title: "Issue 9.5 — Publish E2E + Verification"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-009, issue-905, e2e, publish, verification, typecheck, build]
related_documents:
  - "README.md"
  - "social-publish-architecture.md"
  - "social-publish-stack-proposal.md"
  - "Issue-901.md"
  - "Issue-902.md"
  - "Issue-903.md"
  - "Issue-904.md"
related_sprint: "Sprint-009"
---

# Issue 9.5 — Publish E2E + Verification

> **Sprint:** 9 (Milestone 10: Social Publish & Scheduling)  
> **Estimate:** S (1-2 hours)  
> **Dependencies:** Issues 9.1-9.4 (all publish components complete)  
> **Blockers:** None

---

## 1. Objective

Perform end-to-end verification of the publish & scheduling pipeline:
1. Connect a YouTube social account (mock or real).
2. Schedule a publish for an approved job with a video artifact.
3. Run the scheduler → worker (mock YouTube adapter) → write result back.
4. Verify the platform URL is recorded.
5. Run `pnpm run typecheck` + `pnpm run build` + unit/E2E tests.

---

## 2. Deliverables

### 2.1 Mock YouTube adapter (for E2E without a real key)

```typescript
// workers/publish-real/src/adapters/youtube.mock.ts
export const youtubeMockAdapter: PlatformAdapter = {
  async publish({ title }): Promise<PublishResult> {
    // Simulate a successful YouTube upload without consuming API quota
    return { videoId: `mock-${Date.now()}`, url: `https://youtu.be/mock-${Date.now()}`, platform: 'youtube' };
  },
};
```

### 2.2 E2E test: `tests/e2e/publish.test.ts`

```typescript
// tests/e2e/publish.test.ts
import { describe, it, expect } from 'vitest';
import { prisma } from '@fyi/database';

describe('Publish & Scheduling E2E', () => {
  it('schedules + publishes an approved job via mock adapter', async () => {
    // 1. Insert a social account (youtube)
    const account = await prisma.socialAccount.create({ data: { tenantId: 't1', platform: 'youtube', displayName: 'Test', accountRef: 'ch-1', tokenRef: 'secret:test' } });
    // 2. Insert a scheduled publish for an approved job
    const scheduled = await prisma.scheduledPublish.create({ data: { tenantId: 't1', jobId: 'job-1', socialAccountId: account.id, scheduledAt: new Date() } });
    // 3. Run the sweep → mock worker → handlePublishResult
    await runPublishE2E(scheduled.id);   // helper using mock adapter
    // 4. Verify published + URL recorded
    const row = await prisma.scheduledPublish.findUniqueOrThrow({ where: { id: scheduled.id } });
    expect(row.status).toBe('published');
    expect(row.platformResponse?.url).toMatch(/youtu\.be|youtube/);
  });
});
```

### 2.3 Root scripts (optional)

```json
{
  "scripts": {
    "publish:seed": "pnpm tsx services/publish/scripts/seed-publish.ts"
  }
}
```

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Mock adapter simulates a YouTube upload (no real quota) | E2E passes |
| 2 | Schedule → sweep → publish → result-back flow works end-to-end | E2E: DB `status=published` + URL |
| 3 | `pnpm run typecheck` passes (entire monorepo) | CI check |
| 4 | `pnpm run build` passes (entire monorepo) | CI check |
| 5 | Unit tests for scheduler + adapter (≥80% coverage) | `pnpm test` |
| 6 | No Dashboard page-load platform calls (guard) | Code review + E2E guard |

---

## 4. Implementation Notes

- **Mock first** — run the E2E with the mock YouTube adapter; a real key can be added later without changing the flow.
- **Quota awareness** — the mock avoids consuming the real YouTube quota during tests (ADR-0009).

---

## 5. Definition of Done

- [ ] E2E publish flow passes with mock adapter
- [ ] Typecheck/build pass for the entire monorepo
- [ ] Unit tests ≥80% coverage
- [ ] No page-load platform API calls

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [social-publish-architecture.md](../architecture/social-publish-architecture.md)
- **ADR-0009 (quota / mock to avoid unit consumption):** [../../adr/ADR-0009-platform-analytics-ingestion.md](../../adr/ADR-0009-platform-analytics-ingestion.md)
