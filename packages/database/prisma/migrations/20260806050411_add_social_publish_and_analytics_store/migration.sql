-- CreateTable
CREATE TABLE "social_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(255) NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "account_ref" VARCHAR(255) NOT NULL,
    "token_ref" VARCHAR(255) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "connected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sync_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_publishes" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(255) NOT NULL,
    "job_id" UUID NOT NULL,
    "social_account_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "platform_response" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "scheduled_publishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_metrics" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(255) NOT NULL,
    "video_id" VARCHAR(255) NOT NULL,
    "platform" VARCHAR(50) NOT NULL DEFAULT 'youtube',
    "snapshot_date" TIMESTAMPTZ(6) NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "watch_time_minutes" INTEGER NOT NULL DEFAULT 0,
    "retention_pct" DOUBLE PRECISION,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_revenue" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(255) NOT NULL,
    "video_id" VARCHAR(255) NOT NULL,
    "platform" VARCHAR(50) NOT NULL DEFAULT 'youtube',
    "revenue" DECIMAL(14,6) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "period" VARCHAR(50) NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_revenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_ingestion_log" (
    "id" UUID NOT NULL,
    "run_started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "run_finished_at" TIMESTAMPTZ(6),
    "units_consumed" INTEGER NOT NULL DEFAULT 0,
    "units_remaining" INTEGER NOT NULL DEFAULT 10000,
    "status" TEXT NOT NULL DEFAULT 'running',
    "error" JSONB,

    CONSTRAINT "analytics_ingestion_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_social_account_tenant_platform" ON "social_accounts"("tenant_id", "platform");

-- CreateIndex
CREATE INDEX "idx_scheduled_publish_status_time" ON "scheduled_publishes"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "idx_scheduled_publish_job" ON "scheduled_publishes"("job_id");

-- CreateIndex
CREATE INDEX "idx_platform_metric_tenant_time" ON "platform_metrics"("tenant_id", "snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "platform_metrics_video_id_platform_snapshot_date_key" ON "platform_metrics"("video_id", "platform", "snapshot_date");

-- CreateIndex
CREATE INDEX "idx_video_revenue_tenant" ON "video_revenue"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_revenue_video_id_platform_period_key" ON "video_revenue"("video_id", "platform", "period");

-- CreateIndex
CREATE INDEX "idx_ingestion_log_started" ON "analytics_ingestion_log"("run_started_at");

-- AddForeignKey
ALTER TABLE "scheduled_publishes" ADD CONSTRAINT "scheduled_publishes_social_account_id_fkey" FOREIGN KEY ("social_account_id") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
