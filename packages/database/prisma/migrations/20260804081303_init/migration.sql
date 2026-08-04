-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING_APPROVAL', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(255) NOT NULL,
    "recipe_id" VARCHAR(255) NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "current_step_index" INTEGER NOT NULL DEFAULT 0,
    "recipe_snapshot" JSONB NOT NULL,
    "artifacts" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry" (
    "id" SERIAL NOT NULL,
    "job_id" UUID NOT NULL,
    "execution_id" VARCHAR(255) NOT NULL,
    "worker_id" VARCHAR(255) NOT NULL,
    "worker_version" VARCHAR(50) NOT NULL,
    "provider" VARCHAR(50),
    "model" VARCHAR(50),
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "seconds" INTEGER,
    "cost" DECIMAL(10,6),
    "duration_ms" INTEGER,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_jobs_tenant_status" ON "jobs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "idx_jobs_created_at" ON "jobs"("created_at");

-- CreateIndex
CREATE INDEX "idx_telemetry_job" ON "telemetry"("job_id");

-- CreateIndex
CREATE INDEX "idx_telemetry_worker" ON "telemetry"("worker_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_telemetry_provider" ON "telemetry"("provider", "model", "created_at");

-- AddForeignKey
ALTER TABLE "telemetry" ADD CONSTRAINT "telemetry_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
