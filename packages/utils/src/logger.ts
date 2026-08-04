import pino from 'pino';

/**
 * Structured pino logger (JSON). Per Engineering Standards v1.0 §4:
 * - Every log line MUST include `job_id` and `execution_id`.
 * - Levels: INFO (lifecycle), WARN (non-fatal), ERROR (failures).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});

/**
 * Enforce the mandatory job_id/execution_id context on every log line.
 * Call at the start of each task to scope all subsequent logs to the execution.
 */
export function createTaskLogger(
  base: { job_id: string; execution_id: string } & Record<string, unknown>,
): pino.Logger {
  return logger.child(base);
}
