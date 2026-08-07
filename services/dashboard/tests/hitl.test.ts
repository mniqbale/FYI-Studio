// Unit tests for the HITL write routes (ADR-0010) — approve + revise.
// Mocks @fyi/supervisor so no live Redis/DB/workers are needed; verifies the
// route wiring, response shapes, and validation of the revise payload.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerRoutes } from '../src/routes/index.js';

vi.mock('@fyi/supervisor', () => ({
  approveJob: vi.fn(),
  reviseStep: vi.fn(),
}));

import * as supervisor from '@fyi/supervisor';

describe('HITL write routes (ADR-0010)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await registerRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/jobs/:id/approve returns ok when supervisor approves', async () => {
    vi.mocked(supervisor.approveJob).mockResolvedValue({ ok: true, jobId: 'job-1' });
    const res = await app.inject({ method: 'POST', url: '/api/jobs/job-1/approve' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, job_id: 'job-1' });
  });

  it('POST /api/jobs/:id/approve returns 409 when supervisor rejects (wrong state)', async () => {
    vi.mocked(supervisor.approveJob).mockResolvedValue({ ok: false, jobId: 'job-1', error: 'not WAITING_APPROVAL' });
    const res = await app.inject({ method: 'POST', url: '/api/jobs/job-1/approve' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain('WAITING_APPROVAL');
  });

  it('POST /api/jobs/:id/revise returns ok with valid payload', async () => {
    vi.mocked(supervisor.reviseStep).mockResolvedValue({ ok: true, jobId: 'job-1' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs/job-1/revise',
      payload: { step: 1, input: { script: 'Revised script' } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, job_id: 'job-1', step: 1 });
    expect(supervisor.reviseStep).toHaveBeenCalledWith('job-1', 1, { script: 'Revised script' });
  });

  it('POST /api/jobs/:id/revise returns 400 on invalid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs/job-1/revise',
      payload: { step: 'one', input: 'not-an-object' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/jobs/:id/revise returns 409 when supervisor rejects', async () => {
    vi.mocked(supervisor.reviseStep).mockResolvedValue({ ok: false, jobId: 'job-1', error: 'step index out of range' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs/job-1/revise',
      payload: { step: 9, input: { script: 'x' } },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain('step index');
  });

  it('POST /api/jobs/:id/approve with a non-UUID id is handled (no Prisma crash)', async () => {
    vi.mocked(supervisor.approveJob).mockResolvedValue({ ok: false, jobId: 'not-a-uuid', error: 'Job not found: not-a-uuid' });
    const res = await app.inject({ method: 'POST', url: '/api/jobs/not-a-uuid/approve' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain('Job not found');
  });
});
