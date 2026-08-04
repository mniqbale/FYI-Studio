---
id: adr-readme
title: "Architecture Decision Records Index"
owner: "Documentation Architect"
status: "active"
version: "1.0.0"
last_updated: "2026-08-04"
review_cycle: "per-adr"
tags: [adr, architecture-decisions, index]
related_documents:
  - "ADR-0001-mvp-architecture.md"
  - "ADR-0002-contracts-v11.md"
  - "ADR-0003-reference-based-data-plane.md"
  - "ADR-0004-thin-orchestrator.md"
  - "ADR-0005-engineering-standards.md"
  - "ADR-0006-user-configurable-provider-connection.md"
  - "ADR-0007-ai-platform-foundation.md"
---

# Architecture Decision Records (ADR) Index

> **Rule:** Every architectural change requires an ADR. ADRs are immutable — never modify old ADRs, create new ones.

---

## ADR List

| ID | Title | Status | Date | Supersedes |
|----|-------|--------|------|------------|
| [ADR-0001](./ADR-0001-mvp-architecture.md) | Adopt Thin Orchestrator MVP Architecture | Accepted | 2026-08-04 | — |
| [ADR-0002](./ADR-0002-contracts-v11.md) | Freeze Contracts v1.1 with Strict Enums & Execution Tracking | Accepted | 2026-08-04 | — |
| [ADR-0003](./ADR-0003-reference-based-data-plane.md) | Reference-Based Data Plane (S3 Pointers Only) | Accepted | 2026-08-04 | — |
| [ADR-0004](./ADR-0004-thin-orchestrator.md) | Thin Orchestrator with BullMQ + PostgreSQL | Accepted | 2026-08-04 | — |
| [ADR-0005](./ADR-0005-engineering-standards.md) | Adopt Engineering Standards v1.0 | Accepted | 2026-08-04 | — |
| [ADR-0006](./ADR-0006-user-configurable-provider-connection.md) | User-Configurable Provider Connections & Capability-Filtered Model Selection | Proposed | 2026-08-04 | — |
| [ADR-0007](./ADR-0007-ai-platform-foundation.md) | Introduce AI Platform Foundation as Milestone 2 (BYOAI Layer) | Accepted | 2026-08-04 | — |

---

## ADR Template

When creating a new ADR, use this format:

```markdown
---
id: ADR-XXXX-title
title: "Short Title"
status: "Proposed | Accepted | Rejected | Superseded"
date: "YYYY-MM-DD"
deciders: [List of roles/names]
tags: [architecture, contracts, data-plane, etc.]
---

# ADR-XXXX: Title

## Context
What is the issue that we're seeing that is motivating this decision or change?

## Decision
What is the change that we're proposing and/or doing?

## Alternatives Considered
What other options did we evaluate? Why were they rejected?

## Consequences
What becomes easier or harder to do because of this change?

## Implementation Notes
Any specific implementation details, migration steps, or follow-up tasks.
```

---

## When to Create an ADR

Create an ADR when:
- Changing system architecture (orchestrator, workers, data flow)
- Modifying contracts (TaskEnvelope, WorkerResponse, Job Ledger schema)
- Changing engineering standards (naming, error handling, testing)
- Adding/removing major components (Registry, Router, SDK, Vector DB)
- Changing technology stack (database, queue, language, runtime)

**Reference:** [Architecture Manifesto](../architecture/architecture-manifesto.md) Section 8 (Governance) — "RFC Compliance" and "Violation Rejection" rules.