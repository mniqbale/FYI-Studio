---
id: sprint-009-issue-903
title: "Issue 9.3 — Publishing Worker + YouTube Adapter"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-009, issue-903, publish-worker, youtube, adapter, videos-insert]
related_documents:
  - "README.md"
  - "social-publish-architecture.md"
  - "social-publish-stack-proposal.md"
  - "Issue-901.md"
related_sprint: "Sprint-009"
---

# Issue 9.3 — Publishing Worker + YouTube Adapter

> **Sprint:** 9 (Milestone 10: Social Publish & Scheduling)  
> **Estimate:** M (3-5 hours)  
> **Dependencies:** Issue 9.1 (Schema)  
> **Blockers:** None

---

## 1. Objective

Implement the **publishing worker** and the **YouTube platform adapter**:
- `services/publish` (service: handler/orchestration).
- `workers/publish-real` (worker: consumes `publish-queue`, performs the upload).
- **YouTube adapter** via YouTube Data API v3 `videos.insert` (the primary monetization target).
- A pluggable `PlatformAdapter` interface so Facebook/Instagram/TikTok can be added later.

---

## 2. Deliverables

### 2.1 `workers/publish-real/src/adapters/types.ts` (Pluggable adapter interface)

```typescript
// workers/publish-real/src/adapters/types.ts
export interface PublishRequest {
  videoPath: string;    // file pointer (ADR-0003); no binary through orchestrator
  title: string;
  description: string;
  tokenRef: string;     // resolved to OAuth token via secret manager
}
export interface PublishResult {
  videoId: string;
  url: string;
  platform: string;
}
export interface PlatformAdapter {
  publish(req: PublishRequest): Promise<PublishResult>;
}
```

### 2.2 `workers/publish-real/src/adapters/youtube.ts` (YouTube adapter)

```typescript
// workers/publish-real/src/adapters/youtube.ts
import { PlatformAdapter, PublishRequest, PublishResult } from './types.js';

export const youtubeAdapter: PlatformAdapter = {
  async publish({ videoPath, title, description, tokenRef }): Promise<PublishResult> {
    // Resolve OAuth token from secret manager via tokenRef
    const token = await resolveToken(tokenRef);

    // YouTube Data API v3 videos.insert (resumable upload)
    // NOTE: 1,600 units per upload against the 10k/day budget (ADR-0009)
    const res = await uploadVideo({
      accessToken: token,
      videoPath,
      snippet: { title, description },
      status: { privacyStatus: 'private' },  // private first; founder makes public
    });

    return { videoId: res.videoId, url: `https://youtu.be/${res.videoId}`, platform: 'youtube' };
  },
};
```

### 2.3 `workers/publish-real/src/index.ts` (BullMQ worker)

```typescript
// workers/publish-real/src/index.ts
import { Worker } from 'bullmq';
import { redis } from '@fyi/utils';
import { youtubeAdapter } from './adapters/youtube.js';

const worker = new Worker('publish-queue', async (job) => {
  const { scheduledPublishId, tenantId, jobId, adapter } = job.data;
  const adapterImpl = adapter === 'youtube' ? youtubeAdapter : /* future */ null;
  if (!adapterImpl) throw new Error(`No adapter for platform ${adapter}`);

  // Load the publish request (file pointer from job.artifacts.video_url)
  const result = await adapterImpl.publish(/* build from job.data */);
  return result;   // handler writes result back
}, { connection: redis });
```

### 2.4 `services/publish/src/handler.ts` (write result back)

```typescript
// services/publish/src/handler.ts
// On publish-queue completion, write the platform URL back:
export async function handlePublishResult(jobId: string, scheduledPublishId: string, result: PublishResult) {
  await prisma.scheduledPublish.update({
    where: { id: scheduledPublishId },
    data: { status: 'published', platformResponse: result },
  });
  await prisma.job.update({
    where: { id: jobId },
    data: { artifacts: { ...(await getArtifacts(jobId)), published: result } },
  });
}
```

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `PlatformAdapter` interface + `youtubeAdapter` implemented | Code review |
| 2 | YouTube upload uses file pointer (ADR-0003), no binary through orchestrator | Code review |
| 3 | Upload returns `videoId` + `url` | Unit test with mock |
| 4 | Result written back to `scheduled_publishes.platform_response` + `jobs.artifacts.published` | E2E / DB check |
| 5 | Failed upload throws retryable error (ADR-0004 backoff) | Unit test |
| 6 | `pnpm run typecheck` + `pnpm run build` pass | CI check |

---

## 4. Implementation Notes

- **YouTube-first** — only `youtubeAdapter` is implemented; FB/IG/TikTok are stubbed behind the interface.
- **Quota** — YouTube `videos.insert` = 1,600 units/upload (ADR-0008/0009); upload cadence must respect the shared budget.
- **Privacy** — default to `private`; the Founder makes the video public (monetization decision).

---

## 5. Definition of Done

- [ ] Adapter interface + YouTube adapter implemented
- [ ] Worker consumes `publish-queue` and uploads via Data API v3
- [ ] Result written back to schedule + artifacts
- [ ] Retryable error semantics (ADR-0004)
- [ ] Typecheck/build pass; unit tests (≥80% coverage)

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [social-publish-architecture.md](../architecture/social-publish-architecture.md)
- **ADR-0008 (Publish & Scheduling):** [../../adr/ADR-0008-social-publish-scheduling.md](../../adr/ADR-0008-social-publish-scheduling.md)
- **Reference-Based Data Plane (file pointers):** [../../adr/ADR-0003-reference-based-data-plane.md](../../adr/ADR-0003-reference-based-data-plane.md)
