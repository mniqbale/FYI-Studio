// Media serving route — serves /media/<execution_id>/<file> from the local
// media root via @fastify/static. Supports HTTP Range requests for video seeking.
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { MEDIA_ROOT } from '../utils/media.js';

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  await app.register(fastifyStatic, {
    root: MEDIA_ROOT,
    prefix: '/media/',
    decorateReply: false,
    setHeaders: (res, filePath, stat) => {
      if (stat.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        if (['.mp4', '.webm', '.mp3', '.wav', '.srt', '.vtt'].includes(ext)) {
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.setHeader('Accept-Ranges', 'bytes');
        }
      }
    },
  });
}
