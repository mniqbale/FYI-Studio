-- CreateTable
CREATE TABLE "tenant_policies" (
    "id" UUID NOT NULL,
    "tenant_id" VARCHAR(255) NOT NULL,
    "model_preferences" JSONB DEFAULT '{}',
    "cost_quota" DECIMAL(12,6),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_policies_tenant_id_key" ON "tenant_policies"("tenant_id");
