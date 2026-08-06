// Seed a completed job with media artifacts so the Dashboard has something to show.
// Usage: pnpm tsx services/dashboard/scripts/seed-test-job.ts
// Writes a real (non-empty) video via @fyi/media composeVideo so the browser can play it.

import { prisma } from '../src/utils/prisma.js';
import { loadEnv } from '../src/utils/env.js';
import { execMediaDir, writeTextAsset, toReference } from '@fyi/media';

loadEnv();

async function main(): Promise<void> {
  const tenantId = 'demo-tenant';
  const recipeId = 'video-production-v1';
  const executionId = 'demo-exec-001';
  const { dir } = execMediaDir(executionId);

  // Ensure tenant context + policy exist.
  await prisma.tenantContext.upsert({
    where: { tenant_id: tenantId },
    update: {},
    create: {
      tenant_id: tenantId,
      brand_voice: 'Professional, engaging, and concise. Use active voice. Avoid jargon.',
      language: 'en',
      forbidden_terms: ['guaranteed', 'miracle', 'secret'],
    },
  });
  await prisma.tenantPolicy.upsert({
    where: { tenant_id: tenantId },
    update: {},
    create: {
      tenant_id: tenantId,
      model_preferences: { 'text-synthesis:script': { provider: 'ollama', model: 'deepseek-v4-flash' } },
      cost_quota: 10,
      enabled: true,
    },
  });

  // Write an SRT subtitle asset (text asset via data plane).
  const srtRef = writeTextAsset(
    executionId,
    'subtitles.srt',
    `1\n00:00:00,000 --> 00:00:04,000\nWelcome to FYI Studio.\n\n2\n00:00:04,000 --> 00:00:08,000\nAn AI operating system for distributed media.\n\n3\n00:00:08,000 --> 00:00:12,000\nBuild once, deploy anywhere.`,
  );

  // Compose a short real video with narration so playback actually works.
  // Use a synthesized narration via @fyi/media (espeak-ng, offline, no quota).
  const { synthesizeSpeech, composeVideo } = await import('@fyi/media');
  const narration = await synthesizeSpeech(executionId, 'Welcome to FYI Studio. Build once, deploy anywhere.');
  const composed = await composeVideo({
    execution_id: executionId,
    narration_wav: narration.audio_path,
    subtitles_srt: srtRef,
    title: 'FYI Studio Intro',
  });

  const now = new Date();
  const created = new Date(now.getTime() - 3600_000);

  const job = await prisma.job.create({
    data: {
      tenant_id: tenantId,
      recipe_id: recipeId,
      status: 'COMPLETED',
      current_step_index: 5,
      recipe_snapshot: {
        name: 'Video Production Pipeline',
        steps: [
          { id: 'research', capability: 'research:web', workerLabel: 'research-worker', requiresApproval: false, inputMapping: {} },
          { id: 'script', capability: 'text-synthesis:script', workerLabel: 'script-worker', requiresApproval: false, inputMapping: { topic: 'steps.research.output.summary' } },
          { id: 'voice', capability: 'voice:tts', workerLabel: 'voice-worker', requiresApproval: false, inputMapping: { script: 'steps.script.output.script' } },
          { id: 'subtitle', capability: 'subtitle:generate', workerLabel: 'subtitle-worker', requiresApproval: false, inputMapping: { audio: 'steps.voice.output.audio_url' } },
          { id: 'video', capability: 'video:compose', workerLabel: 'video-worker', requiresApproval: false, inputMapping: {} },
        ],
      },
      artifacts: {
        research: { summary: 'AI orchestration platforms enable BYOAI workflows for media production.' },
        script: { script: 'Welcome to FYI Studio. Build once, deploy anywhere.', title: 'FYI Studio Intro' },
        voice: { audio_url: toReference(narration.audio_path), duration_seconds: composed.duration_seconds },
        subtitle: { subtitle_url: toReference(srtRef), language: 'en' },
        video: { video_path: composed.video_path, duration_seconds: composed.duration_seconds, resolution: composed.resolution, format: composed.format },
        _references: {
          voice_output: toReference(narration.audio_path),
          subtitles: toReference(srtRef),
          video: toReference(composed.video_path),
        },
      },
      created_at: created,
      updated_at: now,
    },
  });

  // Telemetry for each step.
  const steps = [
    { worker_id: 'research-worker', provider: 'ollama', model: 'deepseek-v4-flash', tokens_in: 400, tokens_out: 300, cost: 0.0004, duration_ms: 2500 },
    { worker_id: 'script-worker', provider: 'ollama', model: 'deepseek-v4-flash', tokens_in: 600, tokens_out: 500, cost: 0.0006, duration_ms: 3200 },
    { worker_id: 'voice-worker', provider: 'espeak-ng', model: 'espeak-ng', tokens_in: 0, tokens_out: 0, cost: 0, duration_ms: 400 },
    { worker_id: 'subtitle-worker', provider: 'local', model: 'n/a', tokens_in: 0, tokens_out: 0, cost: 0, duration_ms: 200 },
    { worker_id: 'video-worker', provider: 'ffmpeg', model: 'ffmpeg', tokens_in: 0, tokens_out: 0, cost: 0, duration_ms: 1500 },
  ];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    await prisma.telemetry.create({
      data: {
        job_id: job.id,
        execution_id: `${executionId}-${i}`,
        worker_id: s.worker_id,
        worker_version: '1.0.0',
        provider: s.provider,
        model: s.model,
        tokens_in: s.tokens_in,
        tokens_out: s.tokens_out,
        cost: s.cost,
        duration_ms: s.duration_ms,
        started_at: new Date(created.getTime() + i * 30_000),
        finished_at: new Date(created.getTime() + i * 30_000 + s.duration_ms),
      },
    });
  }

  console.log('✅ Seeded demo job + real video for the Dashboard.');
  console.log(`   Job ID:      ${job.id}`);
  console.log(`   Tenant:      ${tenantId}`);
  console.log(`   Execution:   ${executionId}`);
  console.log(`   Media dir:   ${dir}`);
  console.log(`   Video file:  ${composed.video_path}`);
  console.log(`   Dashboard:   http://localhost:3001/jobs/${job.id}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
