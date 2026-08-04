// Step-Runner: the completion handler. Runs when a worker finishes and BullMQ
// marks the completion-queue job complete. Mirrors supervisor-design.md §7.
//
// Responsibilities: validate response, merge output+references into artifacts,
// write telemetry, advance current_step_index, honor requires_approval, mark
// COMPLETED on the final step, or hand off to dispatch the next step.

import { Prisma, prisma, JobStatus } from '@fyi/database';
import { type WorkerResponse, type ProductionRecipe, WorkerStatus } from '@fyi/contracts';
import { createTaskLogger } from '@fyi/utils';

export interface StepRunnerDeps {
  /** Called when a step succeeds and more steps remain. */
  onStepSucceeded: (jobId: string) => Promise<void>;
}

export class StepRunner {
  private deps: StepRunnerDeps;

  constructor(deps: StepRunnerDeps) {
    this.deps = deps;
  }

  async handleCompletion(jobId: string, response: WorkerResponse): Promise<void> {
    const log = createTaskLogger({ job_id: jobId, execution_id: response.execution_id });
    log.info({ worker_id: response.worker_id, status: response.status }, 'Step completion received');

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      log.error({ job_id: jobId }, 'Job not found for completion');
      return;
    }
    if (job.status === JobStatus.COMPLETED) {
      log.warn({ job_id: jobId }, 'Job already completed; ignoring duplicate completion');
      return;
    }

    const recipe = job.recipe_snapshot as unknown as ProductionRecipe;
    const stepIndex = job.current_step_index;
    const step = recipe.steps[stepIndex];

    if (!step) {
      log.error({ job_id: jobId, step_index: stepIndex }, 'No step at current index; cannot complete');
      return;
    }

    // 1. Handle failure — MVP has no retry (S1.4 scope), so fail the job.
    if (response.status !== WorkerStatus.SUCCESS) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: JobStatus.FAILED },
      });
      log.error(
        { job_id: jobId, error_code: response.error?.code, retryable: response.error?.retryable },
        'Worker step failed; job marked FAILED',
      );
      return;
    }

    // 2. Merge artifacts: output keyed by step.id + new_references under _references.
    const currentArtifacts = (job.artifacts as Record<string, unknown>) ?? {};
    const currentReferences = (currentArtifacts._references as Record<string, string>) ?? {};
    const newArtifacts: Record<string, unknown> = {
      ...currentArtifacts,
      [step.id]: response.output,
      _references: {
        ...currentReferences,
        ...response.new_references,
      },
    };

    // 3. Write telemetry.
    await this.writeTelemetry(jobId, response);

    // 4. Determine next state.
    const nextStepIndex = stepIndex + 1;
    const isLastStep = nextStepIndex >= recipe.steps.length;
    const needsApproval = step.requires_approval;

    let newStatus: JobStatus = JobStatus.RUNNING;
    if (needsApproval) {
      newStatus = JobStatus.WAITING_APPROVAL;
    } else if (isLastStep) {
      newStatus = JobStatus.COMPLETED;
    }

    const data: Prisma.JobUpdateInput = {
      artifacts: newArtifacts as Prisma.InputJsonValue,
      current_step_index: nextStepIndex,
      status: newStatus,
    };

    await prisma.job.update({ where: { id: jobId }, data });
    log.info(
      { job_id: jobId, next_step_index: nextStepIndex, status: newStatus, is_last_step: isLastStep },
      'Job ledger updated after step',
    );

    // 5. Trigger the next step if we're still running (and not awaiting approval / completed).
    if (newStatus === JobStatus.RUNNING) {
      await this.deps.onStepSucceeded(jobId);
    }
  }

  private async writeTelemetry(jobId: string, response: WorkerResponse): Promise<void> {
    await prisma.telemetry.create({
      data: {
        job_id: jobId,
        execution_id: response.execution_id,
        worker_id: response.worker_id,
        worker_version: response.worker_version,
        provider: 'mock',
        model: 'mock-model',
        tokens_in: response.usage.tokens_in ?? null,
        tokens_out: response.usage.tokens_out ?? null,
        seconds: response.usage.seconds ?? null,
        cost: response.usage.cost_estimate ? new Prisma.Decimal(response.usage.cost_estimate) : null,
        duration_ms: response.performance.duration_ms,
        started_at: new Date(response.performance.started_at),
        finished_at: new Date(response.performance.finished_at),
      },
    });
  }
}
