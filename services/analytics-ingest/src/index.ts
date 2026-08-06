// Analytics ingestion service entrypoint (Milestone 11 / ADR-0009).
// Default: start the BullMQ repeatable ingestion worker. With `--once`, run a
// single ingestion cycle and exit (used for E2E / manual verification).
import { loadEnv } from './utils/prisma.js';

loadEnv();

import { prisma } from './utils/prisma.js';
import { logger } from '@fyi/utils';
import { setupRepeatableJob, startIngestionWorker, runOnce } from './scheduler.js';

async function main(): Promise<void> {
  const once = process.argv.includes('--once');
  if (once) {
    await runOnce();
    await prisma.$disconnect();
    process.exit(0);
  }

  await setupRepeatableJob();
  const worker = startIngestionWorker();
  logger.info('Analytics ingestion worker started (repeatable job scheduled)');

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down analytics ingestion worker');
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Analytics ingestion failed to start');
  process.exit(1);
});
