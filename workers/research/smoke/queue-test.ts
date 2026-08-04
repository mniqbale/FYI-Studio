// S1.3 smoke test: push a mock TaskEnvelope v1.1 to the research queue, wait for the
// worker to process it, and read the WorkerResponse from the completion queue.
//
// Usage: (ensure a worker is running) then:
//   npx tsx smoke/queue-test.ts
import { Queue, Worker } from 'bullmq';
import { type TaskEnvelope, type WorkerResponse } from '@fyi/contracts';
import { createRedisConnection } from '@fyi/utils';

const QUEUE_NAME = 'research-queue';
const COMPLETION_QUEUE = 'completion-queue';
const JOB_ID = `smoke-job-${Date.now()}`;
const EXECUTION_ID = `smoke-exec-${Date.now()}`;

async function main(): Promise<void> {
  console.log(`=== S1.3 Queue Smoke Test (job=${JOB_ID}) ===`);

  const envelope: TaskEnvelope = {
    contract_version: '1.1',
    job_id: JOB_ID,
    execution_id: EXECUTION_ID,
    tenant_id: 'smoke-tenant',
    step_id: 'research',
    capability: 'research:mock',
    attempt: 1,
    policy: { provider: 'mock', model: 'mock-model', temperature: 0.7 },
    context: { brand_voice: 'professional', language: 'en', forbidden_terms: [] },
    payload: { topic: 'The Future of AI Media' },
    references: {},
    started_at: new Date().toISOString(),
  };

  const completion = new Queue(COMPLETION_QUEUE, { connection: createRedisConnection() });
  const inbox = new Queue(QUEUE_NAME, { connection: createRedisConnection() });

  let timer: NodeJS.Timeout;
  const resultPromise = new Promise<WorkerResponse | undefined>((resolve, reject) => {
    const watcher = new Worker(COMPLETION_QUEUE, (job) => {
      const response = job.data as WorkerResponse;
      if (response.job_id !== JOB_ID) return;
      console.log('  ✅ WorkerResponse received on completion-queue');
      clearTimeout(timer);
      resolve(response);
    }, { connection: createRedisConnection() });

    timer = setTimeout(() => {
      void watcher.close();
      reject(new Error('Timed out waiting for WorkerResponse on completion-queue'));
    }, 15000);
  });

  await inbox.add('task', envelope, { removeOnComplete: true, removeOnFail: true });
  console.log(`  ✅ TaskEnvelope pushed to ${QUEUE_NAME}`);

  const response = await resultPromise;
  if (!response) {
    throw new Error('No response');
  }

  // Validate contract v1.1
  const checks: Array<[string, boolean]> = [
    ['contract_version === "1.1"', response.contract_version === '1.1'],
    ['execution_id echoes', response.execution_id === EXECUTION_ID],
    ['status === SUCCESS', response.status === 'success'],
    ['has worker_id', typeof response.worker_id === 'string' && response.worker_id.length > 0],
    ['has worker_version', typeof response.worker_version === 'string' && response.worker_version.length > 0],
    ['output is object', typeof response.output === 'object' && response.output !== null],
    ['usage.cost_estimate number', typeof response.usage?.cost_estimate === 'number'],
    ['performance.duration_ms number', typeof response.performance?.duration_ms === 'number'],
    ['performance timestamps', !!response.performance?.started_at && !!response.performance?.finished_at],
    ['has research_brief', typeof (response.output as Record<string, unknown>)?.research_brief === 'string'],
  ];

  let allPass = true;
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
    if (!ok) allPass = false;
  }

  console.log(`\n  duration_ms: ${response.performance?.duration_ms}ms`);
  console.log(`  research_brief: ${(response.output as Record<string, unknown>)?.research_brief}`);

  await completion.close();
  await inbox.close();

  if (!allPass) {
    throw new Error('Contract validation FAILED');
  }
  console.log('\n=== S1.3 Queue Smoke Test: ALL PASSED ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n=== S1.3 Queue Smoke Test FAILED ===');
  console.error(err);
  process.exit(1);
});
