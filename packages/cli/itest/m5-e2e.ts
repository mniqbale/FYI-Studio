// M5 E2E — full pipeline research:real -> script:real -> voice:real ->
// subtitle:real -> video:real, then verify the video artifact exists.
import { readFileSync } from 'node:fs';
import { prisma, JobStatus } from '@fyi/database';
import { upsertTenantKnowledge } from '@fyi/knowledge';

function loadEnv(path: string): void {
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx <= 0) continue;
    const k = t.slice(0, idx).trim();
    if (!process.env[k]) process.env[k] = t.slice(idx + 1).trim();
  }
}
loadEnv('/workspaces/FYI-Studio/.env');

const TENANT = 'm5-e2e-brand';
const recipe = {
  name: 'm5-e2e',
  steps: [
    { id: 'research', capability: 'research:real', worker_label: 'real-research-v1', requires_approval: false, input_mapping: { topic: 'research.topic' } },
    { id: 'script', capability: 'text-synthesis:script:real', worker_label: 'real-script-v1', requires_approval: false, input_mapping: { research_brief: 'research.research_brief' } },
    { id: 'voice', capability: 'speech-synthesis:voice:real', worker_label: 'real-voice-v1', requires_approval: false, input_mapping: { narration: 'script.script' } },
    { id: 'subtitle', capability: 'subtitle:generate:real', worker_label: 'real-subtitle-v1', requires_approval: false, input_mapping: { narration: 'script.script' } },
    { id: 'video', capability: 'video:compose:real', worker_label: 'real-video-v1', requires_approval: false, input_mapping: { narration_wav: 'voice.audio_path', subtitles_srt: 'subtitle.srt_path', title: 'research.topic' } },
  ],
};

async function main(): Promise<void> {
  await upsertTenantKnowledge({
    tenant_id: TENANT,
    brand_voice: 'Clear, concise, and technical.',
    language: 'en',
    forbidden_terms: ['synergy'],
  });

  const job = await prisma.job.create({
    data: {
      tenant_id: TENANT,
      recipe_id: 'm5-e2e',
      status: JobStatus.PENDING,
      current_step_index: 0,
      recipe_snapshot: recipe as unknown as object,
      artifacts: { research: { topic: 'The Future of AI in Video Production' } },
    },
  });
  console.log(`M5_JOB=${job.id}`);

  const deadline = Date.now() + 300000; // 5 min
  let final: { status: string; artifacts: unknown } | null = null;
  while (Date.now() < deadline) {
    const cur = await prisma.job.findUnique({ where: { id: job.id } });
    if (cur && cur.status !== JobStatus.PENDING && cur.status !== JobStatus.RUNNING) { final = cur; break; }
    await new Promise((r) => setTimeout(r, 3000));
  }

  if (!final) { console.log('Job did not reach terminal state in time.'); }
  else {
    console.log(`FINAL status=${final.status}`);
    const a = final.artifacts as Record<string, unknown>;
    const voice = a.voice as Record<string, unknown> | undefined;
    const subtitle = a.subtitle as Record<string, unknown> | undefined;
    const video = a.video as Record<string, unknown> | undefined;
    console.log('voice.audio_path:', voice?.audio_path ?? '(none)');
    console.log('subtitle.srt_path:', subtitle?.srt_path ?? '(none)', 'cues:', subtitle?.cues ?? '(none)');
    console.log('video.video_path:', video?.video_path ?? '(none)', 'dur:', video?.duration_seconds ?? '(none)');
    if (video?.video_path) {
      const { existsSync } = await import('node:fs');
      console.log('video file exists:', existsSync(video.video_path as string));
    }
  }

  await prisma.telemetry.deleteMany({ where: { job_id: job.id } });
  await prisma.job.delete({ where: { id: job.id } });
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('ERR', e); await prisma.$disconnect(); process.exit(1); });
