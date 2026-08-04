import { type ConnectionOptions } from 'bullmq';

/**
 * Build a BullMQ-compatible Redis connection from environment variables.
 * Supports either REDIS_URL or discrete REDIS_HOST/REDIS_PORT.
 *
 * Per Engineering Standards v1.0: shared utilities live in @fyi/utils with
 * explicit versioning. Workers import this factory (never instantiate Redis directly).
 */
export function createRedisConnection(): ConnectionOptions {
  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL };
  }
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null, // BullMQ requirement
  };
}
