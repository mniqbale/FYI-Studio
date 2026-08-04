// Supervisor entrypoint — starts the kernel + completion worker via the shared
// bootstrap. See bootstrap.ts for wiring.

import { createTaskLogger } from '@fyi/utils';
import { createSupervisor } from './bootstrap.js';

const supervisor = createSupervisor();
supervisor.start();

// Graceful shutdown
const shutdown = async (signal: string): Promise<void> => {
  createTaskLogger({ job_id: 'supervisor', execution_id: 'none' }).info({ signal }, 'Shutting down');
  await supervisor.stop();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

export { createSupervisor };
