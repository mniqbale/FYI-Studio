# FYI Studio System Configuration

> This file defines the system-level configuration for the FYI Studio AI-Native Engineering Knowledge Base.

---

## Repository Identity

- **Project Name:** FYI Studio
- **Project Type:** AI Operating System for Distributed Media Production
- **Primary Language:** TypeScript (ESM)
- **Runtime:** Node.js 20 LTS
- **Package Manager:** pnpm (workspaces)

---

## Knowledge Base Structure (`.ai/`)

The `.ai/` folder is the **single source of truth** for all engineering knowledge. It is designed for AI agents to read like a codebase.

### Folder Purposes

| Folder | Purpose | Update Frequency |
|--------|---------|------------------|
| `architecture/` | System design, contracts, standards, supervisor design, roadmap | Per architecture change (ADR required) |
| `planning/` | Sprints, issues, implementation strategy | Per sprint |
| `context/` | Project overview, vision, glossary, goals | Per milestone |
| `adr/` | Architecture Decision Records | Per architectural decision (immutable) |
| `memory/` | Append-only project history | Per significant event |
| `state/` | Current state snapshot | Per task completion |
| `handoff/` | Session continuity | Per session end |
| `prompts/roles/` | AI role prompts | As needed |

---

## Document Standards

### YAML Front Matter (Mandatory)
Every `.md` file in `.ai/` must begin with:

```yaml
---
id: unique-kebab-case-id
title: "Human Readable Title"
owner: "Role (e.g., Documentation Architect, Principal Architect)"
status: "active | draft | archived | superseded"
version: "x.y.z"
last_updated: "YYYY-MM-DD"
review_cycle: "per-sprint | per-adr | per-milestone | per-session | per-task"
tags: [tag1, tag2, tag3]
related_documents:
  - "relative/path/to/doc.md"
  - "another/doc.md"
related_adr: ["ADR-0001", "ADR-0002"]
related_sprint: "Sprint-001"
---
```

### Cross-References
- Use relative paths from repository root
- Reference by `id` in front matter when possible
- Include `related_documents` array in front matter

---

## Governance Rules

### Constitution (`.ai/constitution.md`)
- **Documentation First, Code Second**
- **Every architectural change requires an ADR**
- **Contracts are frozen** — changes require ADR + rebuild all consumers
- **ADRs are immutable** — never modify, create new
- **Engineering Standards are mandatory** — PR checklist enforced

### AI Working Lifecycle (Per Constitution)
```
READ → UNDERSTAND → PLAN → DOCUMENT → IMPLEMENT → VERIFY → UPDATE DOCUMENTATION → SESSION HANDOFF
Never skip a step.
```

### Definition of Done (Project Level)
A task is done when:
1. ✅ Code matches approved Contract version
2. ✅ Documentation updated
3. ✅ Contracts remain valid
4. ✅ Engineering Standards preserved
5. ✅ Architecture consistent
6. ✅ Code quality passes (lint, typecheck, tests)
7. ✅ Current State updated
8. ✅ Session Handoff complete
9. ✅ Another AI can continue immediately

---

## Technology Stack (Approved)

| Layer | Choice | Version | ADR |
|-------|--------|---------|-----|
| Language | TypeScript | 5.x | — |
| Runtime | Node.js | 20 LTS | — |
| Package Manager | pnpm | 9.x | — |
| Database | PostgreSQL | 15+ | ADR-0001 |
| Queue | BullMQ + Redis | 5.x / 7+ | ADR-0001, ADR-0004 |
| ORM | Prisma | 5.x | — |
| Contracts | @fyi/contracts | 1.1.0 | ADR-0002 |
| Logging | pino | 9.x | ADR-0005 |
| Testing | Vitest + MSW | Latest | ADR-0005 |
| Lint/Format | Biome | Latest | — |

---

## Contract Versioning

- **Current:** v1.1 (Frozen per ADR-0002)
- **Field:** `contract_version: '1.1'` on all envelopes/responses
- **Policy:** Semantic versioning; breaking changes require new ADR
- **Migration:** `contract_version` enables runtime validation + graceful degradation

---

## Naming Conventions (Enforced)

| Context | Convention |
|---------|------------|
| JSON/Database fields | `snake_case` |
| TypeScript variables/functions | `camelCase` |
| TypeScript Classes/Enums/Interfaces | `PascalCase` |
| Files | `kebab-case.ts` |
| Environment Variables | `UPPER_SNAKE_CASE` |
| Git Branches | `kebab-case` |

---

## Error Handling (Enforced)

- **No silent failures** — Every catch logs with `job_id` + `execution_id`
- **Structured errors** — Workers return `WorkerResponse` with `WorkerError`
- **Retry separation** — Workers flag `retryable`; Supervisor controls backoff
- **Standard codes** — `RATE_LIMIT_EXCEEDED`, `PROVIDER_UNAVAILABLE`, `INVALID_INPUT`, etc.

---

## Idempotency (Enforced)

- **Key:** `execution_id` (UUID per attempt)
- **Storage:** Redis/S3 keyed by `execution_id`
- **S3 Paths:** Must include `execution_id` to prevent overwrites
- **Supervisor:** Generates new `execution_id` per attempt

---

## Logging (Enforced)

- **Format:** JSON (pino)
- **Mandatory fields:** `job_id`, `execution_id`, `timestamp`, `level`, `message`
- **Levels:** `INFO` (lifecycle), `WARN` (non-fatal), `ERROR` (failures)

---

## Testing (Enforced)

- **Contract tests mandatory** — Every worker validates against `@fyi/contracts`
- **Zero real network calls** — All external APIs mocked (MSW)
- **Coverage:** 80% lines, 100% error paths
- **Categories:** Unit, Contract, Integration, E2E

---

## Dependency Management (Enforced)

- **Minimalism** — Question every `npm install`; prefer native Node.js
- **Isolation** — Workers share only `@fyi/contracts`
- **Shared utils** → `@fyi/utils` package with explicit versioning
- **No `workspace:*` for runtime deps** — Workers independently deployable

---

## Session Management

### Starting a Session
1. Read `.ai/context/start-here.md` completely
2. Follow the 14-document required reading order
3. Check `.ai/state/current-state.md` for current progress
4. Read latest `.ai/handoff/YYYY-MM-DD_Handoff.md`

### Ending a Session
1. Update `.ai/state/current-state.md`
2. Create `.ai/handoff/YYYY-MM-DD_Handoff.md` with:
   - Session Summary
   - Decisions Made
   - Files Changed
   - Documentation Updated
   - ADR Created
   - Current Sprint Status
   - Blockers
   - Next Recommended Task
   - Instructions For Next AI
   - Repository Status

---

## CI/CD Requirements (Planned)

| Check | Tool | Required |
|-------|------|----------|
| TypeScript Compile | `tsc --noEmit` | ✅ |
| Lint | Biome | ✅ |
| Unit Tests | Vitest | ✅ |
| Contract Tests | Vitest + schema validation | ✅ |
| Integration Tests | Vitest + Testcontainers | ✅ |
| E2E Tests | Vitest | ✅ |
| Coverage Thresholds | Vitest | 80% lines, 100% error paths |

---

## Directory Permissions

| Path | Access |
|------|--------|
| `.ai/` | Read/Write (AI Agents) |
| `packages/` | Read/Write (Implementation) |
| `services/` | Read/Write (Implementation) |
| `workers/` | Read/Write (Implementation) |
| `tests/` | Read/Write (Implementation) |
| `docker-compose.yml` | Read/Write (Implementation) |
| `package.json` | Read/Write (Implementation) |

---

## Environment Variables (Required)

| Variable | Description | Required For |
|----------|-------------|--------------|
| `DATABASE_URL` | PostgreSQL connection string | All services |
| `REDIS_URL` | Redis connection string | Supervisor, Workers |
| `S3_ENDPOINT` | S3/R2 endpoint | Media Workers (Milestone 3+) |
| `S3_ACCESS_KEY` | S3 access key | Media Workers |
| `S3_SECRET_KEY` | S3 secret key | Media Workers |
| `OPENAI_API_KEY` | OpenAI API key | Script Worker (Milestone 2+) |
| `ANTHROPIC_API_KEY` | Anthropic API key | Script Worker (Milestone 2+) |
| `ELEVENLABS_API_KEY` | ElevenLabs API key | Voice Worker (Milestone 3+) |
| `LOG_LEVEL` | pino log level (default: info) | All services |

---

*This SYSTEM.md defines the operating rules for the FYI Studio knowledge base and implementation. Update when governance or stack decisions change (via ADR).*