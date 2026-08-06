// Prisma client singleton (re-exported from @fyi/database). The dashboard is a
// READ-ONLY surface — it must NEVER write to the Job Ledger (dashboard-architecture.md §2).
import { prisma } from '@fyi/database';

export { prisma };
export { JobStatus } from '@fyi/database';
