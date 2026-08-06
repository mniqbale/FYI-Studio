---
id: sprint-009-issue-901
title: "Issue 9.1 — Social Account + Schedule Schema"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-009, issue-901, schema, prisma, social-accounts, scheduled-publishes, migration]
related_documents:
  - "README.md"
  - "social-publish-architecture.md"
  - "social-publish-stack-proposal.md"
related_sprint: "Sprint-009"
---

# Issue 9.1 — Social Account + Schedule Schema

> **Sprint:** 9 (Milestone 10: Social Publish & Scheduling)  
> **Estimate:** S (1-2 hours)  
> **Dependencies:** None  
> **Blockers:** None

---

## 1. Objective

Add the two new database tables for the publish & scheduling workstream (ADR-0008):
- **`social_accounts`** — registry of connected social accounts per tenant (OAuth token ref, never the token).
- **`scheduled_publishes`** — what to publish, to which account, and when (status machine).

These are **additive** tables; Contracts v1.1 remain frozen (no change to `TaskEnvelope`/`WorkerResponse`).

---

## 2. Deliverables

### 2.1 Prisma schema additions (`packages/database/prisma/schema.prisma`)

```prisma
model SocialAccount {
  id           String    @id @default(uuid())
  tenantId     String
  platform     String    // 'youtube' | 'facebook' | 'instagram' | 'tiktok'
  displayName  String
  accountRef   String    // platform channel/account id
  tokenRef     String    // OAuth credential reference (never the token)
  enabled      Boolean   @default(true)
  connectedAt  DateTime  @default(now())
  lastSyncAt   DateTime?
  schedules    ScheduledPublish[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([tenantId, platform])
}

model ScheduledPublish {
  id               String    @id @default(uuid())
  tenantId         String
  jobId            String
  socialAccountId  String
  scheduledAt      DateTime
  status           String    @default("scheduled") // scheduled | publishing | published | failed
  platformResponse Json?     // videoId, url, error
  attempts         Int       @default(0)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  socialAccount    SocialAccount @relation(fields: [socialAccountId], references: [id])

  @@index([status, scheduledAt])
  @@index([jobId])
}
```

### 2.2 Migration

```bash
cd packages/database
pnpm prisma migrate dev --name add_social_accounts_and_scheduled_publishes
pnpm prisma generate
```

### 2.3 Update the published Prisma client types

Run `pnpm prisma generate` so `@fyi/database` exposes `socialAccount` + `scheduledPublish` models to consumers.

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Migration applies cleanly | `pnpm prisma migrate status` clean |
| 2 | `socialAccount` + `scheduledPublish` models available in `@fyi/database` | `pnpm prisma generate` + typecheck |
| 3 | Indexes on `(tenantId, platform)` and `(status, scheduledAt)` present | Prisma schema check |
| 4 | No change to existing tables / Contracts v1.1 | Code review |
| 5 | `pnpm run typecheck` + `pnpm run build` pass | CI check |

---

## 4. Implementation Notes

- **Additive only** — do not modify existing models (`jobs`, `telemetry`, `tenant_context`, `tenant_policies`, `provider_connections`, etc.).
- **`tokenRef`** — stores a reference, never the OAuth token (ADR-0006/0007 pattern; material in secret manager).
- **Status machine** — `scheduled → publishing → published | failed`; `attempts` tracks retries.

---

## 5. Definition of Done

- [ ] Migration adds both tables
- [ ] Prisma client regenerated with new models
- [ ] Typecheck/build pass
- [ ] No changes to existing schema / Contracts v1.1

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [social-publish-architecture.md](../architecture/social-publish-architecture.md)
- **ADR-0008 (Publish & Scheduling):** [../../adr/ADR-0008-social-publish-scheduling.md](../../adr/ADR-0008-social-publish-scheduling.md)
