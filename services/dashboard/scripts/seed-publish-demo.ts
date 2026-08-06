// Seed a publish demo: connect a YouTube social account + schedule a publish
// for an approved (completed) job with a video artifact. (Issue 9.2 / ADR-0008)
import { prisma } from '../src/utils/prisma.js';
import { loadEnv } from '../src/utils/env.js';
import { connectSocialAccount, schedulePublish } from '@fyi/publish';

loadEnv();

async function main(): Promise<void> {
  const tenantId = process.env.SEED_TENANT_ID ?? 'demo';

  // Find a completed job with a video artifact.
  const job = await prisma.job.findFirst({
    where: { status: 'COMPLETED' },
    orderBy: { created_at: 'desc' },
  });
  if (!job) {
    console.error('No COMPLETED job found. Run `pnpm run dashboard:seed` first.');
    process.exit(1);
  }

  // Connect a YouTube account (token stored by reference).
  const account = await connectSocialAccount({
    tenant_id: tenantId,
    platform: 'youtube',
    display_name: 'Demo Channel',
    account_ref: 'UC-demo',
    access_token: 'demo-access-token-not-real',
  });
  console.log(`Connected YouTube account: ${account.id}`);

  // Schedule a publish ~5 minutes from now.
  const scheduledAt = new Date(Date.now() + 5 * 60 * 1000);
  const scheduled = await schedulePublish({
    tenant_id: tenantId,
    job_id: job.id,
    social_account_id: account.id,
    scheduled_at: scheduledAt,
  });
  console.log(`Scheduled publish: ${scheduled.id} for job ${job.id} at ${scheduledAt.toISOString()}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
