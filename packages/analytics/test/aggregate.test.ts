// Unit tests for @fyi/analytics aggregation + cost logic (Milestone 7).
//
// Mocks '@fyi/database' so no DB is needed: we stub prisma.telemetry.findMany
// with canned rows and assert the pure aggregation/cost math. `tenantSummary`
// and `jobSummary` filter by tenant/job via the query args — the mock inspects
// the `where` clause to prove the filter reaches the DB.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The module under test imports `prisma` from '@fyi/database'. Mock that module
// and provide a controllable telemetry.findMany spy.
const findManyMock = vi.fn();
vi.mock('@fyi/database', () => ({
  prisma: { telemetry: { findMany: (...args: unknown[]) => findManyMock(...args) } },
}));

// Import AFTER vi.mock so the ESM bindings are the mocked ones.
const {
  overallSummary,
  tenantSummary,
  jobSummary,
  tenantUnitEconomics,
} = await import('./../src/index.js');

type TelRow = {
  cost?: unknown;
  tokens_in?: unknown;
  tokens_out?: unknown;
  duration_ms?: unknown;
  worker_id?: string;
  provider?: string | null;
  model?: string | null;
};

const ROWS: TelRow[] = [
  // job A, tenant t1
  { cost: 1.0, tokens_in: 100, tokens_out: 50, duration_ms: 1000, worker_id: 'w1' },
  { cost: 2.0, tokens_in: 200, tokens_out: 100, duration_ms: 2000, worker_id: 'w2' },
  // job B, tenant t1
  { cost: 0.5, tokens_in: 50, tokens_out: 25, duration_ms: 500, worker_id: 'w1' },
  // job C, tenant t2
  { cost: 3.0, tokens_in: 300, tokens_out: 150, duration_ms: 3000, worker_id: 'w3' },
];

describe('aggregate: overallSummary', () => {
  beforeEach(() => findManyMock.mockReset());

  it('sums cost/tokens/duration across all canned rows and counts jobs', async () => {
    findManyMock.mockResolvedValue(ROWS);
    const s = await overallSummary();

    expect(s.jobs).toBe(4);
    expect(s.cost).toBe(1.0 + 2.0 + 0.5 + 3.0);
    expect(s.tokens_in).toBe(100 + 200 + 50 + 300);
    expect(s.tokens_out).toBe(50 + 100 + 25 + 150);
    expect(s.duration_ms).toBe(1000 + 2000 + 500 + 3000);
    expect(s.avg_duration_ms).toBe(Math.round((1000 + 2000 + 500 + 3000) / 4));
  });

  it('returns zeros when there are no telemetry rows', async () => {
    findManyMock.mockResolvedValue([]);
    const s = await overallSummary();
    expect(s).toEqual({ jobs: 0, cost: 0, tokens_in: 0, tokens_out: 0, duration_ms: 0, avg_duration_ms: 0 });
  });

  it('treats null/undefined numeric fields as zero', async () => {
    findManyMock.mockResolvedValue([
      { cost: null, tokens_in: null, tokens_out: undefined, duration_ms: null },
      { cost: undefined, tokens_in: 5, tokens_out: 5, duration_ms: 10 },
    ]);
    const s = await overallSummary();
    expect(s.cost).toBe(0);
    expect(s.tokens_in).toBe(5);
    expect(s.tokens_out).toBe(5);
    expect(s.duration_ms).toBe(10);
  });
});

describe('aggregate: tenantSummary', () => {
  beforeEach(() => findManyMock.mockReset());

  it('filters by tenant via the joined job and sums matching rows', async () => {
    findManyMock.mockImplementation(async (args: { where?: { job?: { tenant_id?: string } } }) => {
      if (args?.where?.job?.tenant_id === 't1') return [ROWS[0], ROWS[1], ROWS[2]];
      return [];
    });

    const s = await tenantSummary('t1');

    // Assert the filter was passed to the DB query.
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { job: { tenant_id: 't1' } } }),
    );
    // t1 rows are the first three.
    expect(s.jobs).toBe(3);
    expect(s.cost).toBe(1.0 + 2.0 + 0.5);
    expect(s.tokens_in).toBe(100 + 200 + 50);
    expect(s.duration_ms).toBe(1000 + 2000 + 500);
  });

  it('returns zeros when the tenant has no telemetry', async () => {
    findManyMock.mockImplementation(async (args: { where?: { job?: { tenant_id?: string } } }) =>
      args?.where?.job?.tenant_id === 't-unknown' ? [] : [],
    );
    const s = await tenantSummary('t-unknown');
    expect(s).toEqual({ jobs: 0, cost: 0, tokens_in: 0, tokens_out: 0, duration_ms: 0, avg_duration_ms: 0 });
  });
});

describe('aggregate: jobSummary', () => {
  beforeEach(() => findManyMock.mockReset());

  it('filters by job_id and groups the rows for that job', async () => {
    findManyMock.mockImplementation(async (args: { where?: { job_id?: string } }) => {
      if (args?.where?.job_id === 'job-a') return [ROWS[0], ROWS[1]];
      return [];
    });

    const s = await jobSummary('job-a');

    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { job_id: 'job-a' } }));
    expect(s.job_id).toBe('job-a');
    expect(s.jobs).toBe(2);
    expect(s.cost).toBe(1.0 + 2.0);
    expect(s.tokens_in).toBe(100 + 200);
    expect(s.duration_ms).toBe(1000 + 2000);
  });

  it('returns zeros for a job with no telemetry', async () => {
    findManyMock.mockResolvedValue([]);
    const s = await jobSummary('job-none');
    expect(s.jobs).toBe(0);
    expect(s.cost).toBe(0);
    expect(s.duration_ms).toBe(0);
  });
});

describe('cost: tenantUnitEconomics', () => {
  beforeEach(() => findManyMock.mockReset());

  it('computes cost_per_job and tokens_per_dollar correctly', async () => {
    findManyMock.mockResolvedValue([
      { cost: 2.0, tokens_in: 100, tokens_out: 50, duration_ms: 1000 },
      { cost: 2.0, tokens_in: 100, tokens_out: 50, duration_ms: 1000 },
    ]);
    const e = await tenantUnitEconomics('t1');

    // 2 jobs, cost = 4.0, tokens = (100+50)*2 = 300, duration = 2000.
    expect(e.cost_per_job).toBe(Math.round((4.0 / 2) * 1000) / 1000); // 2
    expect(e.cost_per_video).toBe(2);
    expect(e.tokens_per_dollar).toBe(Math.round((300 / 4.0) * 1000) / 1000); // 75
    expect(e.avg_cost_per_ms).toBe(Math.round((4.0 / 2000) * 1000) / 1000); // 0.002
  });

  it('guards against zero jobs and zero cost (no division by zero)', async () => {
    findManyMock.mockResolvedValue([]);
    const e = await tenantUnitEconomics('t1');
    expect(e.cost_per_job).toBe(0);
    expect(e.tokens_per_dollar).toBe(0);
    expect(e.avg_cost_per_ms).toBe(0);
  });

  it('treats zero cost as $1 for the tokens_per_dollar denominator', async () => {
    findManyMock.mockResolvedValue([{ cost: 0, tokens_in: 10, tokens_out: 10, duration_ms: 100 }]);
    const e = await tenantUnitEconomics('t1');
    expect(e.tokens_per_dollar).toBe(20); // tokens=20, dollars floored to 1
  });
});
