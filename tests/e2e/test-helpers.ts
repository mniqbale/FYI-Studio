// E2E test helpers — spawn the mock worker + supervisor pipeline as child
// processes, seed jobs, and poll the ledger.

import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { prisma, JobStatus } from '@fyi/database';
import type { ProductionRecipe } from '@fyi/contracts';

const ROOT = resolve(process.cwd());

export const SKELETON_RECIPE: ProductionRecipe = {
  name: 'skeleton-run',
  steps: [
    { id: 'research', capability: 'research:mock', worker_label: 'mock-research-v1', requires_approval: false, input_mapping: { topic: 'research.topic' } },
    { id: 'script', capability: 'text-synthesis:script', worker_label: 'mock-script-v1', requires_approval: false, input_mapping: { research_brief: 'research.research_brief' } },
    { id: 'voice', capability: 'speech-synthesis:voice', worker_label: 'mock-voice-v1', requires_approval: false, input_mapping: { script: 'script.script' } },
  ],
};

function loadEnv(): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...process.env };
  const envPath = resolve(ROOT, '.env');
  if (!existsSync(envPath)) return out;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

const CHILD_ENV = loadEnv();

/** Spawns the 3 workers + the supervisor as child processes. */
export class PipelineManager {
  private children: ChildProcess[] = [];

  start(): void {
    for (const w of ['research', 'script', 'voice']) {
      this.children.push(spawn('node', [resolve(ROOT, 'workers', w, 'dist', 'index.js')], { cwd: ROOT, env: CHILD_ENV, stdio: 'ignore' }));
    }
    this.children.push(spawn('node', [resolve(ROOT, 'services', 'supervisor', 'dist', 'index.js')], { cwd: ROOT, env: CHILD_ENV, stdio: 'ignore' }));
  }

  async stop(): Promise<void> {
    for (const child of this.children) {
      if (child.exitCode === null) child.kill('SIGTERM');
    }
    // Give processes a moment to exit.
    await new Promise((r) => setTimeout(r, 500));
    this.children = [];
  }
}

export async function createTestJob(topic: string): Promise<string> {
  return createTestJobWithRecipe(SKELETON_RECIPE, { research: { topic } });
}

export async function createTestJobWithRecipe(
  recipe: ProductionRecipe,
  artifacts: Record<string, unknown> = {},
): Promise<string> {
  const job = await prisma.job.create({
    data: {
      tenant_id: 'e2e-tenant',
      recipe_id: recipe.name,
      status: JobStatus.PENDING,
      current_step_index: 0,
      recipe_snapshot: recipe as unknown as object,
      artifacts: artifacts as object,
    },
  });
  return job.id;
}

export async function waitForJobCompletion(jobId: string, timeoutMs = 40000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job disappeared from database');
    if (job.status === JobStatus.COMPLETED) return;
    if (job.status === JobStatus.FAILED) throw new Error(`Job failed (status=${job.status})`);
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(`Job did not complete within ${timeoutMs}ms`);
}

export async function cleanupAll(): Promise<void> {
  await prisma.telemetry.deleteMany();
  await prisma.job.deleteMany();
}
