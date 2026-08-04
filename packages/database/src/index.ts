import { PrismaClient } from '@prisma/client';

// Singleton PrismaClient — avoids exhausting DB connections during hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export runtime values (enum + Prisma namespace) and the model types.
export { JobStatus, Prisma } from '@prisma/client';
export type { Job, Telemetry } from '@prisma/client';

export default prisma;
