// Manual E2E check for Milestone 11 ingestion (ADR-0009).
import { loadEnv, prisma } from '../src/utils/prisma.js';
import { runIngestionCycle } from '../src/ingest.js';

loadEnv();

async function main(): Promise<void> {
  const result = await runIngestionCycle();
  console.log('CYCLE RESULT:', JSON.stringify(result));
  const pm = await prisma.platformMetric.count();
  const vr = await prisma.videoRevenue.count();
  const mem = await prisma.memoryEntry.count({ where: { kind: 'analytics' } });
  const logs = await prisma.analyticsIngestionLog.count();
  console.log(`DB: platform_metrics=${pm} video_revenue=${vr} memory(analytics)=${mem} ingestion_logs=${logs}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
