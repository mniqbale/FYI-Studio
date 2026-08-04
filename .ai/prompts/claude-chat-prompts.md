# FYI Studio — Prompt Templates untuk Claude.ai Chat

Copy-paste prompt di bawah ini ke claude.ai sesuai task yang mau dikerjain.
Jalankan berurutan: S1.1 → S1.2 → S1.3 → S1.4 → S1.5 → S1.6

---

## S1.1 — Workspace & Infrastructure Initialization

```
FYI Studio — Issue S1.1: Workspace & Infrastructure Initialization

Goal: Setup monorepo, Docker Compose, and @fyi/contracts package.

Context:
- Ini proyek AI Operating System untuk media production
- Tech stack: TypeScript (ESM), Node.js 20, pnpm workspaces, PostgreSQL 15+, Redis 7+
- Semua dokumentasi ada di folder .ai/ dan CLAUDE.md di root repo
- Aku kerja di GitHub Codespaces (Docker sudah tersedia)

Yang perlu dibuat:
1. Root package.json — pnpm workspace dengan packages/*, services/*, workers/*
2. pnpm-workspace.yaml
3. tsconfig.base.json (base config untuk semua package)
4. docker-compose.yml — PostgreSQL 15+ (port 5432) + Redis 7+ (port 6379)
5. packages/contracts/ — @fyi/contracts v1.1:
   - package.json (name: @fyi/contracts, version: 1.1.0)
   - tsconfig.json (target ES2022, module NodeNext, strict true)
   - src/index.ts — semua interface dan enum dari CLAUDE.md "Core Contracts v1.1" section
6. .gitignore (node_modules, dist, .env, *.log, .DS_Store, .turbo, coverage)

Acceptance Criteria:
- pnpm install berhasil di root
- docker-compose up -d jalan tanpa error
- pnpm --filter @fyi/contracts build menghasilkan dist/ dengan type definitions

Catatan:
- Jangan modifikasi file .ai/ atau CLAUDE.md
- Ikuti Engineering Standards: snake_case di JSON/DB, camelCase/PascalCase di TS, kebab-case untuk file
- Max 300 lines per file
```

---

## S1.2 — Database Layer (Prisma)

```
FYI Studio — Issue S1.2: Database Layer

Goal: Implement Prisma schema and @fyi/database client package.

Context:
- S1.1 sudah selesai (monorepo, contracts, docker-compose)
- PostgreSQL sudah jalan via docker-compose
- Contracts v1.1 sudah di @fyi/contracts

Yang perlu dibuat:
1. packages/database/ — @fyi/database package:
   - package.json (dependencies: @prisma/client, @fyi/contracts; devDependencies: prisma, typescript)
   - tsconfig.json
   - prisma/schema.prisma — dengan model Job dan Telemetry (lihat CLAUDE.md untuk SQL schema)
   - src/index.ts — export PrismaClient instance + helper functions
   - src/seed.ts — function untuk seed ProductionRecipe + Job

2. Prisma schema harus mencakup:
   - Model Job: id (uuid), tenant_id, recipe_id, status (enum), current_step_index, recipe_snapshot (Json), artifacts (Json), created_at, updated_at
   - Model Telemetry: id (auto-increment), job_id (relation ke Job), execution_id, worker_id, worker_version, provider, model, tokens_in, tokens_out, seconds, cost (Decimal), duration_ms, started_at, finished_at, created_at
   - Indexes: idx_jobs_tenant_status, idx_jobs_created_at, idx_telemetry_job, idx_telemetry_worker

3. Root package.json — tambah script "db:generate" dan "db:migrate"

Acceptance Criteria:
- prisma generate berhasil
- prisma migrate dev berhasil (tabel ter-create di Postgres)
- @fyi/database build berhasil

Catatan:
- Ikuti Engineering Standards
- Max 300 lines per file
```

---

## S1.3 — Mock Worker Suite

```
FYI Studio — Issue S1.3: Mock Worker Suite

Goal: Create 3 stateless mock workers (Research, Script, Voice).

Context:
- S1.1 & S1.2 sudah selesai
- Contracts v1.1 sudah di @fyi/contracts
- Workers pakai BullMQ untuk listen queue, Redis sebagai backend
- Setiap worker adalah package sendiri di workers/

Yang perlu dibuat:
1. workers/research/ — Research Mock Worker:
   - package.json (dependencies: @fyi/contracts, bullmq, pino, ioredis)
   - tsconfig.json
   - src/index.ts — BullMQ worker, listen queue "research", simulasikan delay 2 detik, return mock data
   - Pastikan validasi WorkerResponse sesuai contract

2. workers/script/ — Script Mock Worker:
   - Sama struktur, listen queue "script", delay 2 detik
   - Output: mock script text

3. workers/voice/ — Voice Mock Worker:
   - Sama struktur, listen queue "voice", delay 2 detik
   - Output: mock audio reference URL

4. Setiap worker harus:
   - Validasi output terhadap WorkerResponse v1.1
   - Log job_id dan execution_id di setiap langkah (pino)
   - Handle error dengan structured error response (jangan crash)
   - Idempotent berdasarkan execution_id (cache di Redis)

5. Root package.json — tambah script untuk start masing-masing worker

Acceptance Criteria:
- Setiap worker bisa start dan listen ke queue masing-masing
- Worker return WorkerResponse valid dengan semua field required
- Worker handle error case dengan WorkerError

Catatan:
- Ikuti Engineering Standards (error handling, logging, idempotency)
- Max 300 lines per file
```

---

## S1.4 — Supervisor Kernel

```
FYI Studio — Issue S1.4: Supervisor Kernel

Goal: Implement Supervisor core loop — state machine, queue dispatch, step-runner.

Context:
- S1.1, S1.2, S1.3 sudah selesai
- Contracts v1.1, database layer, dan 3 mock workers sudah siap
- Supervisor adalah "Thin Orchestrator" — hanya orchestration, state, policy

Yang perlu dibuat:
1. services/supervisor/ — Supervisor Kernel:
   - package.json (dependencies: @fyi/contracts, @fyi/database, bullmq, pino, ioredis)
   - tsconfig.json
   - src/index.ts — entry point, start supervisor loop

2. Supervisor components:
   a. src/kernel.ts — Main loop:
      - Poll jobs table untuk job dengan status 'pending' atau 'running'
      - Resolve next step dari recipe_snapshot
      - Build TaskEnvelope (dengan execution_id baru per attempt)
      - Dispatch ke BullMQ queue sesuai worker_label
      - Update job status ke 'running'

   b. src/step-runner.ts — Completion handler:
      - Listen BullMQ completed event
      - Validasi WorkerResponse
      - Merge output + new_references ke artifacts
      - Log telemetry ke tabel telemetry
      - Increment current_step_index
      - Check requires_approval → pause jika perlu
      - Jika last step → mark 'completed'
      - Handle failure: retry dengan exponential backoff atau dead letter

   c. src/context-assembler.ts — JIT Context Assembly:
      - Fetch tenant context dari database
      - Resolve input_mapping dari artifacts
      - Build payload untuk TaskEnvelope

   d. src/model-gate.ts — ModelGate utility:
      - Baca model_policy.yaml
      - Map capability → {provider, model, params}

3. services/supervisor/model_policy.yaml:
   ```yaml
   capabilities:
     research:
       provider: "openai"
       model: "gpt-4o"
       temperature: 0.7
     script:
       provider: "anthropic"
       model: "claude-sonnet-4"
       temperature: 0.8
     voice:
       provider: "elevenlabs"
       model: "eleven_multilingual_v2"
   ```

4. Root package.json — tambah script "start:supervisor"

Acceptance Criteria:
- Supervisor bisa start dan poll jobs table
- Sukses handle transisi Research → Script → Voice
- Job status berubah ke COMPLETED setelah step terakhir
- Telemetry tercatat untuk setiap step
- Retry logic bekerja (simulasi failure)

Catatan:
- Supervisor TIDAK boleh contain: direct LLM logic, prompt hardcoding, domain hardcoding, media processing
- Ikuti Engineering Standards
- Max 300 lines per file
```

---

## S1.5 — Skeleton Run CLI

```
FYI Studio — Issue S1.5: Skeleton Run CLI

Goal: CLI tool to seed recipe + job and monitor execution.

Context:
- S1.1–S1.4 sudah selesai
- Supervisor + 3 mock workers sudah jalan
- Database sudah siap

Yang perlu dibuat:
1. packages/cli/ — @fyi/cli:
   - package.json (dependencies: @fyi/contracts, @fyi/database, pino)
   - tsconfig.json
   - src/index.ts — CLI entry point

2. CLI harus bisa:
   a. Seed ProductionRecipe ke database (Research → Script → Voice)
   b. Seed Job baru dengan status 'pending'
   c. Poll database setiap 2 detik dan print status ke console
   d. Output real-time: "Researching...", "Scripting...", "Voicing...", "Done!"
   e. Exit dengan success message + summary (total duration, cost)

3. Root package.json — script "start:skeleton" → node packages/cli/dist/index.js

Acceptance Criteria:
- npm run start:skeleton initiates a job
- CLI outputs status changes in real-time
- CLI exits with success + final artifact summary

Catatan:
- CLI hanya trigger + monitor — Supervisor yang handle orchestration
- Max 300 lines per file
```

---

## S1.6 — E2E Test Suite

```
FYI Studio — Issue S1.6: End-to-End Test Suite

Goal: Automated integration test for full pipeline.

Context:
- S1.1–S1.5 sudah selesai
- Semua komponen sudah jadi

Yang perlu dibuat:
1. tests/e2e/ — E2E test suite:
   - package.json (dependencies: vitest, @fyi/contracts, @fyi/database, @fyi/cli)
   - tsconfig.json
   - src/skeleton-run.test.ts — integration test

2. Test harus:
   a. Setup: connect ke Postgres + Redis (via docker-compose)
   b. Seed ProductionRecipe + Job
   c. Start mock workers (atau pastikan sudah jalan)
   d. Start Supervisor (atau pastikan sudah jalan)
   e. Trigger job via CLI
   f. Wait for completion (timeout 30 detik)
   g. Assertions:
      - Job status = 'completed'
      - artifacts berisi output dari semua 3 steps
      - telemetry.cost_estimate ter-aggregate dengan benar
      - telemetry.duration_ms tercatat untuk setiap step
      - Setiap step punya execution_id unik

3. Root package.json — script "test:e2e" → vitest run tests/e2e

Acceptance Criteria:
- Test passes consistently
- Assertions verify cost aggregation
- Assertions verify duration recording per step

Catatan:
- Test harus deterministic — mock semua timing
- Jangan test real AI providers
- Max 300 lines per file
```
