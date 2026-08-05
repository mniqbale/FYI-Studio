// FYI Studio CLI — analytics & cost intelligence report (M7.4).
//
// Usage:
//   npm run analytics -- report [tenantId]   # cost report per tenant (or one tenant)
//   npm run analytics -- job <jobId>         # summary for a specific job
//   npm run analytics -- overall             # grand totals across all telemetry
//
// Reads DATABASE_URL from env / .env.

import { prisma } from '@fyi/database';
import {
  tenantSummary,
  capabilitySummary,
  overallSummary,
  tenantCostReport,
  formatReport,
  tenantUnitEconomics,
  jobSummary,
} from '@fyi/analytics';

// Load .env
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
(function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx <= 0) continue;
    const k = t.slice(0, idx).trim();
    if (!process.env[k]) process.env[k] = t.slice(idx + 1).trim();
  }
})();

function usage(): void {
  console.log(`Usage:
  fyi analytics report [tenantId]
  fyi analytics job <jobId>
  fyi analytics overall
`);
}

async function cmdReport(tenantId?: string): Promise<void> {
  if (tenantId) {
    const s = await tenantSummary(tenantId);
    const econ = await tenantUnitEconomics(tenantId);
    console.log(`Tenant: ${tenantId}`);
    console.log(`  Jobs: ${s.jobs} | Cost: $${s.cost.toFixed(6)} | Tokens in/out: ${s.tokens_in}/${s.tokens_out} | Duration: ${s.duration_ms}ms`);
    console.log(`  Unit econ: cost/job=$${econ.cost_per_job} | tokens/$${econ.tokens_per_dollar} | avg cost/ms=$${econ.avg_cost_per_ms}`);
  } else {
    const report = await tenantCostReport();
    console.log(formatReport(report));
  }
}

async function cmdJob(jobId: string): Promise<void> {
  const s = await jobSummary(jobId);
  console.log(`Job ${jobId}: jobs=${s.jobs} cost=$${s.cost.toFixed(6)} tokens=${s.tokens_in}/${s.tokens_out} duration=${s.duration_ms}ms`);
}

async function cmdOverall(): Promise<void> {
  const s = await overallSummary();
  console.log(`Overall: jobs=${s.jobs} cost=$${s.cost.toFixed(6)} tokens=${s.tokens_in}/${s.tokens_out} duration=${s.duration_ms}ms`);
}

async function main(): Promise<void> {
  const [cmd, arg] = process.argv.slice(2);
  switch (cmd) {
    case 'report': await cmdReport(arg); break;
    case 'job': await cmdJob(arg ?? ''); break;
    case 'overall': await cmdOverall(); break;
    default: usage();
  }
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('ERR', e); await prisma.$disconnect(); process.exit(1); });
