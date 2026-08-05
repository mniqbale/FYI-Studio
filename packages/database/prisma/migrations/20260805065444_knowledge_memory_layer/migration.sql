-- CreateTable
CREATE TABLE "tenant_context" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(255) NOT NULL,
    "brand_voice" TEXT,
    "language" VARCHAR(50) DEFAULT 'en',
    "style_guide" TEXT,
    "verified_facts" JSONB DEFAULT '[]',
    "asset_library" JSONB DEFAULT '[]',
    "forbidden_terms" JSONB DEFAULT '[]',
    "constraints" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_context_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_entries" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(255) NOT NULL,
    "job_id" UUID,
    "kind" VARCHAR(50) NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_context_tenant_id_key" ON "tenant_context"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_memory_tenant_kind" ON "memory_entries"("tenant_id", "kind");

-- CreateIndex
CREATE INDEX "idx_memory_tenant_created" ON "memory_entries"("tenant_id", "created_at");
