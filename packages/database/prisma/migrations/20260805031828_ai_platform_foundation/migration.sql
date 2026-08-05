-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('ACTIVE', 'DEPRECATED', 'DISABLED');

-- CreateTable
CREATE TABLE "provider_connections" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "scope" VARCHAR(100) NOT NULL DEFAULT 'default',
    "key_ref" VARCHAR(255) NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "health_error" VARCHAR(255),
    "quota_limit" DECIMAL(10,2),
    "quota_used" DECIMAL(10,2),
    "connected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "provider_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_registry" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "version" VARCHAR(50),
    "pricing_per_1k_tokens" DECIMAL(10,6),
    "context_window" INTEGER,
    "status" "ModelStatus" NOT NULL DEFAULT 'ACTIVE',
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "model_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capability_registry" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capability_registry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_connections_provider_scope_key" ON "provider_connections"("provider", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "model_registry_provider_model_key" ON "model_registry"("provider", "model");

-- CreateIndex
CREATE UNIQUE INDEX "capability_registry_name_key" ON "capability_registry"("name");
