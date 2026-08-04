// Generic S1.3 worker smoke test — pushes a TaskEnvelope to a given queue and
// validates the WorkerResponse v1.1 returned on the completion queue.
//
// Usage: npx tsx smoke/worker-check.ts <queue-name> <capability> <mock-output-key> <payload-topic-key> <payload-topic-value>
import { Queue, Worker } from 'bullmq';
import { type TaskEnvelope, type WorkerResponse } from '@fyi/contracts';
import { createRedisConnection } from '@fyi/utils';

const [, , QUEUE_NAME, CAPABILITY, OUTPUT_KEY, TOPIC_KEY, TOPIC_VALUE] = process.argv;

const JOB_ID = `smoke-job-${Date.now()}`;
const EXECUTION_ID = `smoke-exec-${Date.now()}`;

function usage(): never {
  console.error('usage: npx tsx worker-check.ts <queue> <capability> <output-key> <topic-key> <topic-value>');
  process.exit(1);
}

async function main(): Promise<void> {
  if (!QUEUE_NAME || !CAPABILITY || !OUTPUT_KEY || !TOPIC_KEY || !TOPIC_VALUE) usage();
  const COMPLETION_QUEUE = 'completion-queue';
  console.log(`=== S1.3 Worker Check: ${QUEUE_NAME} (job=${JOB_ID}) ===`);

  const envelope: TaskEnvelope = {
    contract_version: '1.1',
    job_id: JOB_ID,
    execution_id: EXECUTION_ID,
    tenant_id: 'smoke-tenant',
    step_id: QUEUE_NAME.replace('-queue', ''),
    capability: CAPABILITY,
    attempt: 1,
    policy: { provider: 'mock', model: 'mock-model', temperature: 0.7 },
    context: { brand_voice: 'professional', language: 'en', forbidden_terms: [] },
    payload: { [TOPIC_KEY]: TOPIC_VALUE },
    references: {},
    started_at: new Date().toISOString(),
  };

  const completion = new Queue(COMPLETION_QUEUE, { connection: createRedisConnection() });
  const inbox = new Queue(QUEUE_NAME, { connection: createRedisConnection() });

  let timer: NodeJS.Timeout;
  const resultPromise = new Promise<WorkerResponse | undefined>((resolve, reject) => {
    const watcher = new Worker(COMPLETION_QUEUE, async (job) => {
      const response = job.data as WorkerResponse;
      if (response.job_id !== JOB_ID) return undefined;
      clearTimeout(timer);
      resolve(response);
      return undefined;
    }, { connection: createRedisConnection() });

    timer = setTimeout(() => {
      void watcher.close();
      reject(new Error('Timed out waiting for WorkerResponse'));
    }, 15000);
  });

  await inbox.add('task', envelope, { removeOnComplete: true, removeOnFail: true });
  console.log(`  ✅ TaskEnvelope pushed to ${QUEUE_NAME}`);
  const response = await resultPromise;
  if (!response) throw new Error('No response');

  const checks: Array<[string, boolean]> = [
    ['contract_version === "1.1"', response.contract_version === '1.1'],
    ['execution_id echoes', response.execution_id === EXECUTION_ID],
    ['status === success', response.status === 'success'],
    ['worker_id present', typeof response.worker_id === 'string' && response.worker_id.length > 0],
    ['worker_version present', typeof response.worker_version === 'string' && response.worker_version.length > 0],
    ['usage.cost_estimate number', typeof response.usage?.cost_estimate === 'number'],
    ['performance.duration_ms number', typeof response.performance?.duration_ms === 'number'],
    ['performance timestamps', !!response.performance?.started_at && !!response.performance?.finished_at],
    [`output has "${OUTPUT_KEY}"`, typeof (response.output as Record<string, unknown>)?.[OUTPUT_KEY] !== 'undefined'],
  ];

  let allPass = true;
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
    if (!ok) allPass = false;
  }

  const out = response.output as Record<string, unknown>;
  const firstOutVal = typeof out[OUTPUT_KEY] === 'string' ? (out[OUTPUT_KEY] as string).slice(0, 60) : JSON.stringify(out[OUTPUT_KEY]).slice(0, 60);
  console.log(`\n  duration_ms: ${response.performance?.duration_ms}ms`);
  console.log(`  ${OUTPUT_KEY}: ${firstOutVal}`);

  await completion.close();
  await inbox.close();
  if (!allPass) throw new Error('Contract validation FAILED');
  console.log(`\n=== S1.3 Worker Check ${QUEUE_NAME}: ALL PASSED ===`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`\n=== S1.3 Worker Check ${QUEUE_NAME} FAILED ===`);
  console.error(err);
  process.exit(1);
});
