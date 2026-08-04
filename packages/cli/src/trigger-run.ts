// S1.5 Skeleton Run CLI — seeds a Milestone 1 job into the ledger, spawns the
// 3 mock workers + the supervisor as child processes, then monitors the DB and
// prints status transitions until the job COMPLETEs or FAILs.
//
// Usage (from repo root):  npm run start-skeleton  ["topic"]

import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { prisma, JobStatus } from '@fyi/database';
import type { ProductionRecipe } from '@fyi/contracts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..', '..');

// ---- Skeleton recipe (matches the supervisor's input_mapping expectations) ----
const SKELETON_RECIPE: ProductionRecipe = {
  name: 'skeleton-run',
  steps: [
    {
      id: 'research',
      capability: 'research:mock',
      worker_label: 'mock-research-v1',
      requires_approval: false,
      input_mapping: { topic: 'research.topic' },
    },
    {
      id: 'script',
      capability: 'text-synthesis:script',
      worker_label: 'mock-script-v1',
      requires_approval: false,
      input_mapping: { research_brief: 'research.research_brief' },
    },
    {
      id: 'voice',
      capability: 'speech-synthesis:voice',
      worker_label: 'mock-voice-v1',
      requires_approval: false,
      input_mapping: { script: 'script.script' },
    },
  ],
};

const POLL_INTERVAL_MS = 2000;

// Load .env (DATABASE_URL, REDIS_URL) into the environment for child processes.
function loadEnv(): NodeJS.ProcessEnv {
  const envPath = resolve(ROOT, '.env');
  const out: NodeJS.ProcessEnv = { ...process.env };
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

function spawnWorker(path: string): ChildProcess {
  return spawn('node', [path], { cwd: ROOT, env: CHILD_ENV, stdio: 'inherit' });
}

const childProcs: ChildProcess[] = [];

function startPipeline(): void {
  const workerDirs = ['research', 'script', 'voice'];
  for (const w of workerDirs) {
    childProcs.push(spawnWorker(resolve(ROOT, 'workers', w, 'dist', 'index.js')));
  }
  childProcs.push(spawnWorker(resolve(ROOT, 'services', 'supervisor', 'dist', 'index.js')));
}

function stopPipeline(): void {
  for (const child of childProcs) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case JobStatus.PENDING: return '⏳';
    case JobStatus.RUNNING: return '▶️';
    case JobStatus.WAITING_APPROVAL: return '🛑';
    case JobStatus.COMPLETED: return '✅';
    case JobStatus.FAILED: return '❌';
    default: return '📍';
  }
}

function prettyStatus(status: string): string {
  return status.replace(/_/g, ' ').toUpperCase();
}

async function main(): Promise<void> {
  // Ensure DATABASE_URL/REDIS_URL are available to this process (tsx doesn't
  // auto-load .env). Prisma reads DATABASE_URL lazily on first query.
  Object.assign(process.env, loadEnv());

  const topic = process.argv[2] || 'The Future of AI in Creative Media';
  console.log('🚀 Starting FYI Studio Skeleton Run...\n');

  // 1. Create the job in the database.
  const job = await prisma.job.create({
    data: {
      tenant_id: 'skeleton-tenant',
      recipe_id: 'skeleton-run',
      status: JobStatus.PENDING,
      current_step_index: 0,
      recipe_snapshot: SKELETON_RECIPE as unknown as object,
      artifacts: { research: { topic } },
    },
  });
  console.log(`📝 Created job: ${job.id}`);
  console.log(`📋 Topic: ${topic}\n`);

  // 2. Start the pipeline (workers + supervisor) in the background.
  console.log('▶️  Starting workers + supervisor...\n');
  startPipeline();

  // Give the pipeline a moment to connect before we start polling.
  await new Promise((r) => setTimeout(r, 2500));

  // 3. Monitor the job until terminal state.
  console.log('👀 Monitoring job status...\n');
  let lastStatus: string | null = null;

  while (true) {
    const current = await prisma.job.findUnique({ where: { id: job.id } });
    if (!current) {
      console.error('❌ Job not found in database!');
      break;
    }

    if (current.status !== lastStatus) {
      console.log(`${getStatusIcon(current.status)}  Status: ${prettyStatus(current.status)}`);
      lastStatus = current.status;
    }

    if (current.status === JobStatus.COMPLETED) {
      console.log('\n🎉 Skeleton Run Completed Successfully!');
      console.log('\n📦 Final Artifacts:');
      console.log(JSON.stringify(current.artifacts, null, 2));
      break;
    }
    if (current.status === JobStatus.FAILED) {
      console.log('\n❌ Job Failed.');
      break;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  stopPipeline();
  await prisma.$disconnect();
  console.log('\n👋 Pipeline shut down. Done.');
  process.exit(0);
}

// Graceful shutdown on Ctrl+C.
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  stopPipeline();
  await prisma.$disconnect();
  process.exit(130);
});

main().catch(async (err) => {
  console.error('💥 Fatal error:', err);
  stopPipeline();
  await prisma.$disconnect();
  process.exit(1);
});
