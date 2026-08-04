// E2E test setup — verifies connectivity to the local infra (Postgres/Redis)
// before the suite runs, and cleans the ledger tables.

import { beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '@fyi/database';

function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    if (!process.env[trimmed.slice(0, idx).trim()]) {
      process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
}

loadEnv();

beforeAll(async () => {
  await prisma.$connect();
  // Start from a clean ledger.
  await prisma.telemetry.deleteMany();
  await prisma.job.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
