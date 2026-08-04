// S1.6 E2E Test Suite — validates the full Milestone 1 Skeleton Run.
// Spins up the 3 mock workers + supervisor, seeds a job, waits for completion,
// and asserts the `artifacts` column + telemetry (cost + duration per step).

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma, JobStatus } from '@fyi/database';
import type { ProductionRecipe } from '@fyi/contracts';
import {
  PipelineManager,
  createTestJob,
  createTestJobWithRecipe,
  waitForJobCompletion,
  cleanupAll,
} from './test-helpers.js';

const pipeline = new PipelineManager();
let started = false;

beforeAll(async () => {
  if (!started) {
    pipeline.start();
    started = true;
    // Give workers + supervisor time to connect to Redis.
    await new Promise((r) => setTimeout(r, 3000));
  }
});

afterAll(async () => {
  if (started) {
    await pipeline.stop();
    started = false;
  }
});

beforeEach(async () => {
  await cleanupAll();
});

describe('Sprint 1: Skeleton Run E2E', () => {
  it('completes a full run through all three workers with artifacts + telemetry', async () => {
    const topic = 'E2E Test Topic: AI in Media';
    const jobId = await createTestJob(topic);

    await waitForJobCompletion(jobId, 40000);

    // --- Assert job state ---
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job).not.toBeNull();
    expect(job!.status).toBe(JobStatus.COMPLETED);
    expect(job!.current_step_index).toBe(3);

    // --- Assert artifacts (nested per step id + _references) ---
    const artifacts = job!.artifacts as Record<string, unknown>;
    const research = artifacts.research as Record<string, unknown>;
    const script = artifacts.script as Record<string, unknown>;
    const voice = artifacts.voice as Record<string, unknown>;

    expect(research?.research_brief).toContain(topic);
    expect(research?.sources).toBeInstanceOf(Array);
    expect(research?.key_findings).toBeInstanceOf(Array);
    expect(script?.script).toContain('Mock script');
    expect(script?.scenes).toBeInstanceOf(Array);
    expect(voice?.audio_url).toBeDefined();
    expect(typeof voice?.duration_seconds).toBe('number');
    expect((artifacts._references as Record<string, string>)?.voice_output).toBeDefined();

    // --- Assert telemetry: 3 rows, one per worker ---
    const telemetry = await prisma.telemetry.findMany({
      where: { job_id: jobId },
      orderBy: { created_at: 'asc' },
    });
    expect(telemetry).toHaveLength(3);
    expect(telemetry.map((t) => t.worker_id).sort()).toEqual([
      'mock-research-v1',
      'mock-script-v1',
      'mock-voice-v1',
    ]);

    // --- Assert usage (cost) recorded & aggregated for every step ---
    for (const t of telemetry) {
      expect(t.cost).not.toBeNull();
      expect(Number(t.cost)).toBeGreaterThan(0);
    }
    const totalCost = telemetry.reduce((sum, t) => sum + Number(t.cost ?? 0), 0);
    expect(totalCost).toBeGreaterThan(0);

    // --- Assert performance (duration_ms) recorded for every step ---
    for (const t of telemetry) {
      expect(t.duration_ms).toBeGreaterThan(1000); // workers simulate ~2s
      expect(t.duration_ms).toBeLessThan(10000);
    }
    const totalDuration = telemetry.reduce((sum, t) => sum + (t.duration_ms ?? 0), 0);
    expect(totalDuration).toBeGreaterThanOrEqual(5000);
  });

  it('correctly aggregates usage cost across all steps', async () => {
    const jobId = await createTestJob('Usage Aggregation Test');
    await waitForJobCompletion(jobId, 40000);

    const telemetry = await prisma.telemetry.findMany({ where: { job_id: jobId } });
    expect(telemetry).toHaveLength(3);
    for (const t of telemetry) {
      expect(Number(t.cost ?? 0)).toBeGreaterThan(0);
    }
    const totalCost = telemetry.reduce((sum, t) => sum + Number(t.cost ?? 0), 0);
    expect(totalCost).toBeGreaterThan(0);
  });

  it('records performance duration for every step', async () => {
    const jobId = await createTestJob('Performance Duration Test');
    await waitForJobCompletion(jobId, 40000);

    const telemetry = await prisma.telemetry.findMany({ where: { job_id: jobId } });
    expect(telemetry).toHaveLength(3);
    for (const t of telemetry) {
      expect(t.duration_ms).toBeGreaterThan(1000);
      expect(t.duration_ms).toBeLessThan(10000);
    }
  });

  it('correctly identifies a failure when a worker cannot be resolved', async () => {
    // A recipe with an unknown capability (no configured queue) causes the
    // supervisor to mark the job FAILED. This proves the E2E detects failures.
    const badRecipe: ProductionRecipe = {
      name: 'bad-run',
      steps: [
        { id: 'research', capability: 'research:mock', worker_label: 'mock-research-v1', requires_approval: false, input_mapping: { topic: 'research.topic' } },
        { id: 'mystery', capability: 'capability:does-not-exist', worker_label: 'nope-v1', requires_approval: false, input_mapping: {} },
      ],
    };
    const jobId = await createTestJobWithRecipe(badRecipe, { research: { topic: 'x' } });

    const deadline = Date.now() + 15000;
    let finalStatus: string | null = null;
    while (Date.now() < deadline) {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (job?.status === JobStatus.FAILED) {
        finalStatus = job.status;
        break;
      }
      await new Promise((r) => setTimeout(r, 750));
    }

    expect(finalStatus).toBe(JobStatus.FAILED);
  });
});
