// Human-in-the-loop (HITL) write operations — ADR-0010.
//
// Approve and Revise are deliberate write operations that break the Dashboard's
// read-only invariant (ADR-0001). Per ADR-0010, ALL writes are routed through
// the Supervisor/StepRunner so the Supervisor remains the sole writer to
// `jobs.status`. The Dashboard calls these functions; it never mutates
// `jobs.status` directly.
//
//   approveJob(jobId)  — resume a WAITING_APPROVAL job: set RUNNING + dispatch
//                        the next step (the step-runner already advanced
//                        current_step_index when it parked the job).
//   reviseStep(jobId, stepIndex, updatedInput) — write edited input into the
//                        target step's artifacts, set RUNNING, point
//                        current_step_index at that step, and re-dispatch it.

import { prisma, JobStatus } from '@fyi/database';
import { type ProductionRecipe } from '@fyi/contracts';
import { createTaskLogger } from '@fyi/utils';
import { createWorkerQueue } from './queue-handler.js';
import { CAPABILITY_QUEUE } from './config.js';
import { resolveInputMapping, extractReferences } from './kernel.js';
import { type TaskEnvelope, type TenantContext } from '@fyi/contracts';
import { DEFAULT_TENANT_CONTEXT } from './config.js';

export interface HitlResult {
  ok: boolean;
  jobId: string;
  error?: string;
}

/** Reject invalid state transitions with a structured error. */
async function guardStatus(jobId: string, allowed: JobStatus[]): Promise<{ job?: Awaited<ReturnType<typeof prisma.job.findUnique>>; error?: string }> {
  // Reject ids that are not valid UUIDs early (Prisma throws P2023 on malformed ids).
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(jobId)) return { error: `Job not found: ${jobId}` };
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { error: `Job not found: ${jobId}` };
  if (!allowed.includes(job.status)) {
    return { error: `Job ${jobId} is in state "${job.status}"; expected "${allowed.join('" or "')}"` };
  }
  return { job };
}

/** Resume a WAITING_APPROVAL job so the Supervisor continues to the next step. */
export async function approveJob(jobId: string): Promise<HitlResult> {
  const log = createTaskLogger({ job_id: jobId, execution_id: 'hitl-approve' });
  const { job, error } = await guardStatus(jobId, [JobStatus.WAITING_APPROVAL]);
  if (!job || error) {
    log.warn({ job_id: jobId, error }, 'Approve rejected');
    return { ok: false, jobId, error };
  }

  // Supervisor is the sole writer to status: set RUNNING, then dispatch the
  // step at the current (already-advanced) index.
  await prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.RUNNING } });
  await dispatchCurrentStep(jobId);
  log.info({ job_id: jobId }, 'Job approved; step re-dispatched');
  return { ok: true, jobId };
}

/**
 * Revise a step: overwrite the target step's artifact input with edited data,
 * rewind current_step_index to that step, set RUNNING, and re-dispatch it.
 */
export async function reviseStep(
  jobId: string,
  stepIndex: number,
  updatedInput: Record<string, unknown>,
): Promise<HitlResult> {
  const log = createTaskLogger({ job_id: jobId, execution_id: 'hitl-revise' });
  const { job, error } = await guardStatus(jobId, [JobStatus.WAITING_APPROVAL, JobStatus.RUNNING]);
  if (!job || error) {
    log.warn({ job_id: jobId, error }, 'Revise rejected');
    return { ok: false, jobId, error };
  }

  const recipe = job.recipe_snapshot as unknown as ProductionRecipe;
  const step = recipe.steps[stepIndex];
  if (!step) {
    const e = `Step index ${stepIndex} out of range (recipe has ${recipe.steps.length} steps)`;
    log.warn({ job_id: jobId, step_index: stepIndex }, 'Revise rejected — bad step index');
    return { ok: false, jobId, error: e };
  }

  // Write edited input into that step's artifact slot (under a `_revised` key
  // so the original is preserved for audit).
  const artifacts = (job.artifacts as Record<string, unknown>) ?? {};
  const revised = {
    ...(artifacts[step.id] as Record<string, unknown> | undefined),
    ...updatedInput,
    _revised_at: new Date().toISOString(),
  };
  const newArtifacts = { ...artifacts, [step.id]: revised };

  await prisma.job.update({
    where: { id: jobId },
    data: {
      artifacts: newArtifacts as never,
      current_step_index: stepIndex,
      status: JobStatus.RUNNING,
    },
  });

  await dispatchStepAt(jobId, stepIndex);
  log.info({ job_id: jobId, step_index: stepIndex }, 'Step revised and re-dispatched');
  return { ok: true, jobId };
}

/** Dispatch the step at the job's current index (after approval resume). */
async function dispatchCurrentStep(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;
  const recipe = job.recipe_snapshot as unknown as ProductionRecipe;
  const step = recipe.steps[job.current_step_index];
  if (!step) return;
  await dispatchStepAt(jobId, job.current_step_index);
}

/** Build + enqueue a TaskEnvelope for a specific step index (re-runnable). */
async function dispatchStepAt(jobId: string, stepIndex: number): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;
  const recipe = job.recipe_snapshot as unknown as ProductionRecipe;
  const step = recipe.steps[stepIndex];
  if (!step) return;

  const queueName = CAPABILITY_QUEUE[step.capability];
  if (!queueName) return;
  const queue = createWorkerQueue(queueName);

  const artifacts = (job.artifacts as Record<string, unknown>) ?? {};
  const executionId = `${jobId}-${step.id}-rerun-${Date.now()}`;
  const payload = resolveInputMapping(step.input_mapping, artifacts);
  const policy = { provider: 'local', model: 'rerun' };

  const envelope: TaskEnvelope = {
    contract_version: '1.1',
    job_id: jobId,
    execution_id: executionId,
    tenant_id: job.tenant_id,
    step_id: step.id,
    capability: step.capability,
    attempt: 2,
    policy,
    context: DEFAULT_TENANT_CONTEXT as TenantContext,
    payload,
    references: extractReferences(artifacts),
    started_at: new Date().toISOString(),
  };

  try {
    await queue.add(`step-${step.id}-rerun`, envelope, { removeOnComplete: 100, removeOnFail: 50 });
    createTaskLogger({ job_id: jobId, execution_id: executionId }).info(
      { step_id: step.id, capability: step.capability, queue_name: queueName },
      'Re-dispatched step after HITL operation',
    );
  } finally {
    await queue.close();
  }
}
