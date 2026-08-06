// Seed a published video for ingestion E2E / manual verification (Milestone 11).
// Creates a `scheduled_publishes` row with status='published' + a videoId.
import { loadEnv, prisma } from '../src/utils/prisma.js';
import { seedPublishedVideo } from '../src/utils/videos.js';

loadEnv();

async function main(): Promise<void> {
  const tenantId = process.env.SEED_TENANT_ID ?? 'e2e-tenant';
  const videoId = process.env.SEED_VIDEO_ID ?? `seed-${Date.now().toString(36)}`;
  const publishId = await seedPublishedVideo({ tenantId, videoId });
  console.log(`Seeded published video: tenant=${tenantId} videoId=${videoId} publishId=${publishId}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
