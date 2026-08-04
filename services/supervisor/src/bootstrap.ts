// Shared bootstrap for the Supervisor: wires the completion worker (StepRunner)
// + kernel polling loop into one unit. Used by both the production entrypoint
// (index.ts) and the integration test (itest/run-integration.ts).

import { type Worker } from 'bullmq';
import { type WorkerResponse } from '@fyi/contracts';
import { createTaskLogger } from '@fyi/utils';
import { createCompletionWorker } from './queue-handler.js';
import { StepRunner } from './step-runner.js';
import { SupervisorKernel } from './kernel.js';

export interface SupervisorHandle {
  start: () => void;
  stop: () => Promise<void>;
  kernel: SupervisorKernel;
}

export function createSupervisor(): SupervisorHandle {
  const kernel = new SupervisorKernel();
  const stepRunner = new StepRunner({
    onStepSucceeded: (jobId) => kernel.dispatchRunnableJob(jobId),
  });

  let completionWorker: Worker | undefined;
  let running = false;

  return {
    kernel,
    start() {
      if (running) return;
      running = true;

      completionWorker = createCompletionWorker(async (job) => {
        const data = job.data as { job_id: string } & Partial<WorkerResponse>;
        if (!data.job_id) {
          createTaskLogger({ job_id: 'unknown', execution_id: 'unknown' }).warn(
            {},
            'Completion message missing job_id',
          );
          return;
        }
        await stepRunner.handleCompletion(data.job_id, data as unknown as WorkerResponse);
      });

      completionWorker.on('failed', (job, err) => {
        createTaskLogger({ job_id: 'completion', execution_id: 'none' }).error(
          { error_message: err.message },
          'Completion worker job failed',
        );
      });

      kernel.start();
      createTaskLogger({ job_id: 'supervisor', execution_id: 'none' }).info(
        {},
        'Supervisor started (kernel + completion worker)',
      );
    },
    async stop() {
      running = false;
      if (completionWorker) {
        await completionWorker.close();
        completionWorker = undefined;
      }
      await kernel.shutdown();
    },
  };
}
