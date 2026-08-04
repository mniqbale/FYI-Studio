// Supervisor Kernel: the main loop and step dispatcher.
// Mirrors supervisor-design.md §6 (main loop) + §9 (queue dispatching).
//
// Flow:
//   1. Poll the Job Ledger for runnable jobs (PENDING or RUNNING with a
//      current_step_index that still points at a step).
//   2. For each, resolve the step, assemble a TaskEnvelope from artifacts via
//      input_mapping, and dispatch to the worker queue.
//   3. Completion is handled asynchronously by the StepRunner.

import { prisma, JobStatus } from '@fyi/database';
import {
  type TaskEnvelope,
  type TenantContext,
  type ProductionRecipe,
  type RecipeStep,
} from '@fyi/contracts';
import { createTaskLogger } from '@fyi/utils';
import { type Queue } from 'bullmq';
import { createWorkerQueue } from './queue-handler.js';
import {
  CAPABILITY_QUEUE,
  CAPABILITY_POLICY,
  DEFAULT_TENANT_CONTEXT,
} from './config.js';

const POLL_INTERVAL_MS = 1500;

export class SupervisorKernel {
  private workerQueues: Map<string, Queue>;
  private running = false;
  private pollTimer?: NodeJS.Timeout;

  constructor() {
    // Lazily create queues for the capabilities we know about.
    this.workerQueues = new Map<string, Queue>();
    for (const queueName of new Set(Object.values(CAPABILITY_QUEUE))) {
      this.workerQueues.set(queueName, createWorkerQueue(queueName));
    }
  }

  /** Start the polling loop (returns immediately). */
  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = async (): Promise<void> => {
      if (!this.running) return;
      try {
        await this.poll();
      } catch (err) {
        createTaskLogger({ job_id: 'kernel', execution_id: 'none' }).error(
          { error_message: err instanceof Error ? err.message : String(err) },
          'Supervisor poll iteration failed',
        );
      }
      this.pollTimer = setTimeout(loop, POLL_INTERVAL_MS);
    };
    void loop();
    createTaskLogger({ job_id: 'kernel', execution_id: 'none' }).info(
      { poll_interval_ms: POLL_INTERVAL_MS },
      'Supervisor kernel started',
    );
  }

  /** Stop the polling loop. */
  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  /** Poll the ledger and dispatch any runnable jobs. Exposed for tests. */
  async poll(): Promise<void> {
    // Only PENDING jobs are dispatched from the poll loop. Once a job is RUNNING,
    // step chaining is driven exclusively by the StepRunner's onStepSucceeded
    // callback (completion worker). This avoids double-dispatching the same step.
    const runnable = await prisma.job.findMany({
      where: { status: JobStatus.PENDING },
    });

    for (const job of runnable) {
      const recipe = job.recipe_snapshot as unknown as ProductionRecipe;
      const step = recipe.steps[job.current_step_index];
      if (!step) {
        // No more steps but not marked complete (e.g. a stuck job) — fail it.
        createTaskLogger({ job_id: job.id, execution_id: 'none' }).warn(
          { step_index: job.current_step_index },
          'Job has no step at current index; marking FAILED',
        );
        await prisma.job.update({ where: { id: job.id }, data: { status: JobStatus.FAILED } });
        continue;
      }
      await this.dispatchStep(job.id, step, job.tenant_id, job.artifacts as Record<string, unknown>);
    }
  }

  /**
   * Dispatch a single step for a job. Used both by the polling loop (first run /
   * after approval resume) and by the StepRunner onStepSucceeded callback.
   */
  private async dispatchStep(
    jobId: string,
    step: RecipeStep,
    tenantId: string,
    artifacts: Record<string, unknown>,
  ): Promise<void> {
    const queueName = CAPABILITY_QUEUE[step.capability];
    if (!queueName) {
      createTaskLogger({ job_id: jobId, execution_id: 'none' }).error(
        { capability: step.capability },
        'No queue configured for capability',
      );
      await prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.FAILED } });
      return;
    }

    const executionId = `${jobId}-${step.id}-${Date.now()}`;
    const payload = resolveInputMapping(step.input_mapping, artifacts);
    const policy = CAPABILITY_POLICY[step.capability] ?? { provider: 'mock', model: 'mock-model' };

    const envelope: TaskEnvelope = {
      contract_version: '1.1',
      job_id: jobId,
      execution_id: executionId,
      tenant_id: tenantId,
      step_id: step.id,
      capability: step.capability,
      attempt: 1,
      policy,
      context: DEFAULT_TENANT_CONTEXT as TenantContext,
      payload,
      references: extractReferences(artifacts),
      started_at: new Date().toISOString(),
    };

    const queue = this.workerQueues.get(queueName);
    if (!queue) {
      createTaskLogger({ job_id: jobId, execution_id: executionId }).error(
        { queue_name: queueName },
        'Queue instance not found',
      );
      await prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.FAILED } });
      return;
    }

    await prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.RUNNING } });
    await queue.add(`step-${step.id}`, envelope, { removeOnComplete: 100, removeOnFail: 50 });

    createTaskLogger({ job_id: jobId, execution_id: executionId }).info(
      { step_id: step.id, capability: step.capability, queue_name: queueName },
      'Dispatched step to worker queue',
    );
  }

  /** Used by the StepRunner to trigger the next step for a running job. */
  async dispatchRunnableJob(jobId: string): Promise<void> {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.status !== JobStatus.RUNNING) return;
    const recipe = job.recipe_snapshot as unknown as ProductionRecipe;
    const step = recipe.steps[job.current_step_index];
    if (!step) return;
    await this.dispatchStep(job.id, step, job.tenant_id, job.artifacts as Record<string, unknown>);
  }

  /** Shut down queues, step runner worker, and DB. */
  async shutdown(): Promise<void> {
    this.stop();
    for (const queue of this.workerQueues.values()) {
      await queue.close();
    }
    await prisma.$disconnect();
  }
}

/** Resolve a step's `input_mapping` against current artifacts. */
export function resolveInputMapping(
  inputMapping: Record<string, string>,
  artifacts: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [targetKey, sourcePath] of Object.entries(inputMapping)) {
    payload[targetKey] = lookupPath(artifacts, sourcePath);
  }
  return payload;
}

/** Extract references (pointers) from artifacts `_references`. */
export function extractReferences(artifacts: Record<string, unknown>): Record<string, string> {
  const refs = (artifacts._references as Record<string, string>) ?? {};
  return { ...refs };
}

/**
 * Look up a dot-notation path, e.g. "research.output.summary" inside the
 * artifacts object. Falls back to undefined.
 */
function lookupPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
