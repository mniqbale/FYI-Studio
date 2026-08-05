// M5 media smoke — TTS + subtitles + video compose against real ffmpeg/espeak-ng.
import { synthesizeSpeech } from '@fyi/media';
import { generateSubtitles } from '@fyi/media';
import { composeVideo } from '@fyi/media';

const execId = `m5-smoke-${Date.now()}`;

async function main(): Promise<void> {
  const narration = 'Welcome to FYI Studio. This is a test of the video pipeline. Artificial intelligence is reshaping media production.';

  console.log('--- TTS ---');
  const tts = await synthesizeSpeech(execId, narration);
  console.log('audio:', tts.audio_path, 'dur:', tts.duration_seconds);

  console.log('--- Subtitles ---');
  const sub = generateSubtitles(execId, narration);
  console.log('srt:', sub.srt_path, 'cues:', sub.cues, 'total:', sub.total_duration);

  console.log('--- Video ---');
  const vid = await composeVideo({ execution_id: execId, narration_wav: tts.audio_path, subtitles_srt: sub.srt_path, title: 'FYI Studio Demo' });
  console.log('video:', vid.video_path, 'dur:', vid.duration_seconds, vid.resolution);

  console.log('M5_MEDIA_SMOKE_OK');
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
