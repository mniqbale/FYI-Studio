// Unit tests for the shared MediaEngine lifecycle runner (ADR-0012).
// Verifies the standardized process: timing telemetry, error normalization
// (never throws), refs/cost passthrough.
import { describe, it, expect, vi } from 'vitest';

import { runMediaEngine, type MediaEngine } from '../src/media-engine.js';

describe('runMediaEngine lifecycle (ADR-0012)', () => {
  it('returns refs, cost, telemetry on success', async () => {
    const engine: MediaEngine<{ x: string }, { n: number }> = {
      provider: 'test',
      model: 'm',
      run: async () => ({ refs: { audio: 'file:///tmp/a.wav' }, cost_estimate: 1.5, metadata: { n: 7 } }),
    };
    const outcome = await runMediaEngine(engine, { execution_id: 'e' }, { x: 'y' });
    expect(outcome.refs.audio).toBe('file:///tmp/a.wav');
    expect(outcome.cost_estimate).toBe(1.5);
    expect(outcome.metadata?.n).toBe(7);
    expect(outcome.error).toBeUndefined();
    expect(outcome.telemetry.duration_ms).toBeGreaterThanOrEqual(0);
    expect(outcome.telemetry.started_at).toBeTruthy();
    expect(outcome.telemetry.finished_at).toBeTruthy();
  });

  it('normalizes a thrown error into a structured failure (never throws)', async () => {
    const engine: MediaEngine<unknown, unknown> = {
      provider: 'test',
      model: 'boom',
      run: async () => {
        throw new Error('boom');
      },
    };
    await expect(runMediaEngine(engine, { execution_id: 'e' }, {})).resolves.toMatchObject({
      error: { code: 'MEDIA_ERROR', message: 'boom', retryable: false },
      refs: {},
      cost_estimate: 0,
    });
  });

  it('normalizes a non-Error throw (string) safely', async () => {
    const engine: MediaEngine<unknown, unknown> = {
      provider: 'test',
      model: 'str',
      run: async () => {
        throw 'plain string failure';
      },
    };
    const outcome = await runMediaEngine(engine, { execution_id: 'e' }, {});
    expect(outcome.error?.message).toBe('plain string failure');
  });
});
