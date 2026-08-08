// Phase 2.3 — Publishing-aware Channel v1 (AC-1..AC-6).
//
// Seeds a social account for a Business Unit, then schedules a publish for a
// completed job using the Channel's publishing_strategy to resolve the target
// (AC-1, AC-4) and capturing the Publish Intent (AC-3).
//
// DRY-RUN ONLY (AC-6): this creates a 'scheduled' row with intent
// 'publish-ready'. It does NOT trigger any public upload. The publish worker
// only runs when a scheduler sweep fires on a due row — and even then the mock
// adapter is used unless a real YouTube credential is present.
//
// Usage:
//   pnpm tsx services/dashboard/scripts/seed-channel-publish.ts <tenant_id> <job_id> [scheduled_at_iso]
import { prisma } from '../src/utils/prisma.js';
import { loadEnv } from '../src/utils/env.js';
import { resolvePublishTarget, buildPublishIntent, schedulePublish } from '@fyi/publish';

loadEnv();

async function main(): Promise<void> {
  const tenantId = process.argv[2];
  const jobId = process.argv[3];
  const scheduledAt = process.argv[4] ? new Date(process.argv[4]) : new Date(Date.now() + 24 * 3600 * 1000);
  if (!tenantId || !jobId) {
    console.error('Usage: pnpm tsx seed-channel-publish.ts <tenant_id> <job_id> [scheduled_at_iso]');
    process.exit(1);
  }

  // AC-1 / AC-4: resolve the target from the Channel's publishing_strategy.
  const target = await resolvePublishTarget(tenantId);
  console.log(`✅ Resolved publish target from Channel strategy: ${target.platform} (${target.display_name})`);

  // AC-3: build the Publish Intent (Channel -> Brief -> Video -> Account).
  const intent = await buildPublishIntent(tenantId, jobId, target);
  console.log('   Publish Intent:', JSON.stringify(intent));

  // AC-6: schedule only (dry-run) — no public upload.
  const scheduled = await schedulePublish({
    tenant_id: tenantId,
    job_id: jobId,
    social_account_id: target.social_account_id,
    scheduled_at: scheduledAt,
    intent,
  });
  console.log(`✅ Scheduled publish (dry-run): ${scheduled.id}`);
  console.log(`   Status: ${scheduled.status} | scheduled_at: ${scheduled.scheduled_at.toISOString()}`);
  console.log(`   Intent: ${JSON.stringify(scheduled.intent ?? scheduled.platform_response)}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
