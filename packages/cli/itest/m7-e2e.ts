// M7 E2E — Analytics & Cost Intelligence + Memory Enrichment pipeline.
//
// Proves the Milestone 7 data path end-to-end against a real DB (no workers,
// no real AI — deterministic and fast):
//   1. Seed a COMPLETED job for a test tenant with a few telemetry rows
//      (cost, tokens, duration).
//   2. Call recordJobPerformance(jobId) and assert a `performance` memory
//      entry is created with the summed cost/duration.
//   3. Call tenantSummary(tenant) and assert cost/tokens/duration match the
//      seeded values.
//   4. Build the CLI cost report (tenantCostReport + formatReport) and assert
//      it contains the test tenant with the correct cost.
//   5. Clean up: delete the job (cascades telemetry) and the memory entry.
import { readFileSync } from 'node:fs';
import { prisma, JobStatus } from '@fyi/database';
import {
  recordJobPerformance,
  tenantSummary,
  tenantCostReport,
  formatReport,
} from '@fyi/analytics';

function loadEnv(path: string): void {
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx <= 0) continue;
    const k = t.slice(0, idx).trim();
    if (!process.env[k]) process.env[k] = t.slice(idx + 1).trim();
  }
}
loadEnv('/workspaces/FYI-Studio/.env');

const TENANT = 'm7-e2e-tenant';

// Seeded telemetry — 3 rows across 2 steps; sum is asserted throughout.
const TEL = [
  { tokens_in: 100, tokens_out: 50, seconds: 10, cost: 0.012, duration_ms: 1000 },
  { tokens_in: 200, tokens_out: 100, seconds: 20, cost: 0.024, duration_ms: 2000 },
  { tokens_in: 50, tokens_out: 25, seconds: 5, cost: 0.006, duration_ms: 500 },
];

const SUM = {
  cost: 0.012 + 0.024 + 0.006,
  tokens_in: 100 + 200 + 50,
  tokens_out: 50 + 100 + 25,
  duration_ms: 1000 + 2000 + 500,
};

let passCount = 0;
let failCount = 0;

function check(name: string, ok: boolean, detail: string): void {
  if (ok) {
    passCount++;
    console.log(`  ✓ ${name}`);
  } else {
    failCount++;
    console.log(`  ✗ ${name} — ${detail}`);
  }
}

function near(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

async function main(): Promise<void> {
  const recipe = {
    name: 'm7-e2e',
    steps: [{ id: 'research', capability: 'research:real', worker_label: 'w1', requires_approval: false, input_mapping: {} }],
  };

  // 1. Seed a COMPLETED job + telemetry.
  const job = await prisma.job.create({
    data: {
      tenant_id: TENANT,
      recipe_id: 'm7-e2e',
      status: JobStatus.COMPLETED,
      current_step_index: 1,
      recipe_snapshot: recipe as unknown as object,
      artifacts: {},
    },
  });

  for (const t of TEL) {
    await prisma.telemetry.create({
      data: {
        job_id: job.id,
        execution_id: `m7-e2e-exec`,
        worker_id: 'm7-worker',
        worker_version: '1.0.0',
        provider: 'ollama',
        model: 'deepseek-v4-flash',
        tokens_in: t.tokens_in,
        tokens_out: t.tokens_out,
        seconds: t.seconds,
        cost: t.cost,
        duration_ms: t.duration_ms,
        started_at: new Date(),
        finished_at: new Date(),
      },
    });
  }
  console.log(`Seeded job ${job.id} with ${TEL.length} telemetry rows for tenant ${TENANT}.`);

  // 2. Memory enrichment: recordJobPerformance creates a performance entry.
  const mem = await recordJobPerformance(job.id);
  check('recordJobPerformance returns a memory entry', mem !== null, 'got null');
  if (mem) {
    check(
      'memory entry kind is "performance"',
      mem.kind === 'performance',
      `got kind=${mem.kind}`,
    );
    const c = (mem.content as Record<string, unknown> | null) ?? {};
    check(
      'memory entry content has summed cost',
      near(Number(c.cost), SUM.cost),
      `got cost=${c.cost}, expected ${SUM.cost}`,
    );
    check(
      'memory entry content has summed duration_ms',
      near(Number(c.duration_ms), SUM.duration_ms),
      `got duration=${c.duration_ms}, expected ${SUM.duration_ms}`,
    );
  }

  // 3. tenantSummary reflects the seeded values.
  const s = await tenantSummary(TENANT);
  check('tenantSummary job count matches telemetry rows', s.jobs === TEL.length, `got jobs=${s.jobs}`);
  check('tenantSummary cost matches', near(s.cost, SUM.cost), `got cost=${s.cost}`);
  check('tenantSummary tokens_in matches', s.tokens_in === SUM.tokens_in, `got tokens_in=${s.tokens_in}`);
  check('tenantSummary tokens_out matches', s.tokens_out === SUM.tokens_out, `got tokens_out=${s.tokens_out}`);
  check('tenantSummary duration matches', s.duration_ms === SUM.duration_ms, `got duration=${s.duration_ms}`);

  // 4. CLI cost report (tenantCostReport + formatReport) contains the tenant.
  const report = await tenantCostReport();
  check('cost report contains the test tenant', report[TENANT] !== undefined, `keys=${Object.keys(report)}`);
  if (report[TENANT]) {
    check('cost report cost matches', near(report[TENANT].cost, SUM.cost), `got ${report[TENANT].cost}`);
    check('cost report jobs matches', report[TENANT].jobs === TEL.length, `got ${report[TENANT].jobs}`);
  }
  const formatted = formatReport(report);
  check(
    'formatReport renders the tenant line',
    formatted.includes(TENANT) && formatted.includes(SUM.cost.toFixed(6)),
    `report:\n${formatted}`,
  );

  // 5. Cleanup: delete memory entry, then job (telemetry cascades).
  await prisma.memoryEntry.deleteMany({ where: { tenant_id: TENANT } });
  await prisma.telemetry.deleteMany({ where: { job_id: job.id } });
  await prisma.job.delete({ where: { id: job.id } });
  console.log('Cleaned up seeded job, telemetry, and memory entry.');

  console.log(`\nRESULT: ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exitCode = 1;
}

main()
  .then(() => {
    if (failCount === 0) console.log('M7-E2E PASSED');
    else console.log('M7-E2E FAILED');
  })
  .catch(async (e) => {
    console.error('ERR', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
