// Unit tests for the JSON/ZIP artifact download routes (Workstream D, point 6).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { jobsRoutes } from '../src/routes/jobs.js';
import { buildZip, artifactsAsZipFiles, crc32 } from '../src/utils/downloads.js';

vi.mock('../src/utils/data.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/data.js')>();
  return { ...actual, getJobsList: vi.fn(), getJobDetail: vi.fn() };
});

import * as data from '../src/utils/data.js';

const mockJobDetail = () => ({
  job: {
    id: 'job-1', tenantId: 't1', recipeId: 'r1', status: 'completed', currentStepIndex: 2,
    recipeSnapshot: { steps: [] },
    artifacts: {
      research: { summary: 'A research summary', sources: ['https://example.com/a', 'https://example.com/b'] },
      script: { script: 'Hello world' },
      _references: { video: 'file:///tmp/fyi-studio/exec/video.mp4' },
    },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  telemetry: [],
  mediaUrls: [],
  videoRef: null,
});

describe('Artifact Download Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await jobsRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('builds a valid ZIP with all artifact JSON files', async () => {
    vi.mocked(data.getJobDetail).mockResolvedValue(mockJobDetail());
    const res = await app.inject({ method: 'GET', url: '/jobs/job-1/download' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
    // ZIP magic number
    const buf = res.rawPayload;
    expect(buf.subarray(0, 2).toString('hex')).toBe('504b'); // PK
    // Should contain all-artifacts.json + artifact-research.json
    const zipStr = buf.toString('latin1');
    expect(zipStr).toContain('all-artifacts.json');
    expect(zipStr).toContain('artifact-research.json');
  });

  it('downloads a single artifact JSON', async () => {
    vi.mocked(data.getJobDetail).mockResolvedValue(mockJobDetail());
    const res = await app.inject({ method: 'GET', url: '/jobs/job-1/download?file=artifact-script.json' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const body = JSON.parse(res.body);
    expect(body.script).toBe('Hello world');
  });

  it('returns 404 for a missing file', async () => {
    vi.mocked(data.getJobDetail).mockResolvedValue(mockJobDetail());
    const res = await app.inject({ method: 'GET', url: '/jobs/job-1/download?file=nope.json' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for an unknown job', async () => {
    vi.mocked(data.getJobDetail).mockRejectedValue(Object.assign(new Error('not found'), { statusCode: 404 }));
    const res = await app.inject({ method: 'GET', url: '/jobs/nope/download' });
    expect(res.statusCode).toBe(404);
  });

  it('artifactsAsZipFiles splits each artifact into a JSON file', () => {
    const files = artifactsAsZipFiles({
      research: { summary: 'x' },
      script: { script: 'y' },
      _references: { video: 'file:///a' },
    });
    expect(files['artifact-research.json']).toBeDefined();
    expect(files['artifact-script.json']).toBeDefined();
    expect(files['references.json']).toBeDefined();
    expect(files['all-artifacts.json']).toBeDefined();
  });
});

describe('downloads util (ZIP writer)', () => {
  it('buildZip produces a PK-zip buffer and crc32 helper works', () => {
    const zip = buildZip({ 'a.txt': 'hello' });
    expect(zip.subarray(0, 2).toString('hex')).toBe('504b');
    expect(crc32(Buffer.from('hello'))).toBeGreaterThan(0);
  });
});
