---
id: sprint-007-issue-704
title: "Issue 7.4 — Media Serving Route (Video/Audio/Subtitle Playback)"
owner: "Lead Engineer (AI Agent)"
status: "done"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-007, issue-704, media, static, video, audio, subtitle, fastify-static, range-requests]
related_documents:
  - "README.md"
  - "dashboard-architecture.md"
  - "dashboard-stack-proposal.md"
  - "Issue-701.md"
  - "Issue-702.md"
  - "Issue-703.md"
related_sprint: "Sprint-007"
---

# Issue 7.4 — Media Serving Route

> **Sprint:** 7 (Milestone 8: Dashboard UI)  
> **Estimate:** S (1-2 hours)  
> **Dependencies:** Issue 7.1 (Scaffold)  
> **Blockers:** None

---

## 1. Objective

Implement `/media/*` static file serving route using `@fastify/static` to serve video, audio, and subtitle files from the local media root (`/tmp/fyi-studio` by default). Must support HTTP Range requests for video seeking.

---

## 2. Deliverables

### 2.1 `services/dashboard/src/utils/media.ts`

```typescript
// services/dashboard/src/utils/media.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MEDIA_ROOT = process.env.FYI_MEDIA_ROOT ?? '/tmp/fyi-studio';

/**
 * Extract execution ID from artifact URL
 * file:///tmp/fyi-studio/abc-123-def/video.mp4 → abc-123-def
 */
export function extractExecutionId(artifactUrl: string): string {
  const match = artifactUrl.match(/\/fyi-studio\/([^/]+)\//);
  return match?.[1] ?? 'unknown';
}

/**
 * Convert artifact URL to media route URL
 * file:///tmp/fyi-studio/abc-123-def/video.mp4 → /media/abc-123-def/video.mp4
 */
export function artifactToMediaUrl(artifactUrl: string): string {
  const executionId = extractExecutionId(artifactUrl);
  const filename = path.basename(artifactUrl);
  return `/media/${executionId}/${filename}`;
}

/**
 * Get all media files for an execution ID
 */
export async function getMediaFiles(executionId: string): Promise<string[]> {
  const fs = await import('node:fs/promises');
  const execDir = path.join(MEDIA_ROOT, executionId);
  try {
    const files = await fs.readdir(execDir);
    return files.map(f => `/media/${executionId}/${f}`);
  } catch {
    return [];
  }
}

/**
 * Check if media file exists
 */
export async function mediaFileExists(executionId: string, filename: string): Promise<boolean> {
  const fs = await import('node:fs/promises');
  const filePath = path.join(MEDIA_ROOT, executionId, filename);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
```

### 2.2 `services/dashboard/src/routes/media.ts`

```typescript
// services/dashboard/src/routes/media.ts
import { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEDIA_ROOT } from '../utils/media.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function mediaRoutes(app: FastifyInstance) {
  // Register static file serving for /media/*
  await app.register(fastifyStatic, {
    root: MEDIA_ROOT,
    prefix: '/media/',
    decorateReply: false,
    // Cache control for media files
    setHeaders: (res, pathStat) => {
      if (pathStat.isFile()) {
        const ext = path.extname(pathStat.name).toLowerCase();
        if (['.mp4', '.webm', '.mp3', '.wav', '.srt', '.vtt'].includes(ext)) {
          // Allow caching for media files, but support Range requests
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.setHeader('Accept-Ranges', 'bytes');
        }
      }
    },
  });

  // Optional: Directory listing for debugging (disable in production)
  if (process.env.NODE_ENV === 'development') {
    app.get('/media/', async (request, reply) => {
      const fs = await import('node:fs/promises');
      try {
        const dirs = await fs.readdir(MEDIA_ROOT, { withFileTypes: true });
        const html = `
          <!DOCTYPE html>
          <html><head><title>Media Directory</title>
          <link rel="stylesheet" href="/assets/style.css"></head>
          <body>
            <header class="dashboard-header"><h1>Media Directory</h1><nav><a href="/">Dashboard</a></nav></header>
            <main class="dashboard-main">
              <h2>Executions in ${MEDIA_ROOT}</h2>
              <ul>${dirs.filter(d => d.isDirectory()).map(d => `<li><a href="/media/${d.name}/">${d.name}/</a></li>`).join('')}</ul>
            </main>
          </body></html>
        `;
        return reply.type('text/html').send(html);
      } catch (e) {
        return reply.code(500).send({ error: 'Cannot read media directory' });
      }
    });

    app.get('/media/:executionId/', async (request, reply) => {
      const { executionId } = request.params as { executionId: string };
      const fs = await import('node:fs/promises');
      const execDir = path.join(MEDIA_ROOT, executionId);
      try {
        const files = await fs.readdir(execDir, { withFileTypes: true });
        const html = `
          <!DOCTYPE html>
          <html><head><title>Execution ${executionId}</title>
          <link rel="stylesheet" href="/assets/style.css"></head>
          <body>
            <header class="dashboard-header"><h1>Execution: ${executionId}</h1><nav><a href="/">Dashboard</a> | <a href="/media/">Media Root</a></nav></header>
            <main class="dashboard-main">
              <ul>
                ${files.map(f => `
                  <li>
                    <a href="/media/${executionId}/${f.name}">${f.name}</a>
                    ${f.isFile() ? ` (${(await fs.stat(path.join(execDir, f.name))).size} bytes)` : ''}
                  </li>
                `).join('')}
              </ul>
            </main>
          </body></html>
        `;
        return reply.type('text/html').send(html);
      } catch {
        return reply.code(404).send({ error: 'Execution not found' });
      }
    });
  }
}
```

### 2.3 Update `services/dashboard/src/index.ts` to Register Media Routes

```typescript
// services/dashboard/src/index.ts (updated)
import Fastify, { FastifyInstance } from 'fastify';
import { registerRoutes } from './routes/index.js';
import { mediaRoutes } from './routes/media.js';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: { target: 'pino-pretty', options: { colorize: true } },
    },
  });

  // Register API + HTML routes
  await registerRoutes(app);
  
  // Register media static serving
  await mediaRoutes(app);

  // Health check
  app.get('/health', async () => ({ status: 'ok', service: 'dashboard' }));

  return app;
}

async function start() {
  const app = await buildApp();
  const port = Number(process.env.PORT) ?? 3001;
  const host = process.env.HOST ?? '0.0.0.0';

  try {
    await app.listen({ port, host });
    app.log.info(`🚀 Dashboard running at http://${host}:${port}`);
    app.log.info(`📁 Media root: ${process.env.FYI_MEDIA_ROOT ?? '/tmp/fyi-studio'}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

start();
```

### 2.4 Update Job Detail Template for Media Links

In `templates/job-detail.ts`, enhance artifact rendering to link all media files:

```typescript
// In renderJobDetailPage, update the artifacts section:
${job.artifacts ? Object.entries(job.artifacts).map(([key, value]) => {
  const mediaUrl = typeof value === 'string' && value.startsWith('file://') 
    ? artifactToMediaUrl(value) 
    : null;
  return `
    <div class="artifact-card" data-key="${key}">
      <h4>${key}</h4>
      <pre>${JSON.stringify(value, null, 2)}</pre>
      ${mediaUrl ? `
        ${key.includes('video') ? `<video controls class="video-player" src="${mediaUrl}"></video>` : ''}
        ${key.includes('audio') ? `<audio controls class="audio-player" src="${mediaUrl}"></audio>` : ''}
        ${key.includes('subtitle') ? `<a href="${mediaUrl}" target="_blank" class="btn">Download Subtitles</a>` : ''}
        ${!key.includes('video') && !key.includes('audio') && !key.includes('subtitle') ? `<a href="${mediaUrl}" target="_blank" class="btn">Open File</a>` : ''}
      ` : ''}
    </div>
  `;
}).join('') : '<p>No artifacts yet</p>'}
```

Need to import `artifactToMediaUrl` in the template.

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `GET /media/<execution_id>/video.mp4` serves video file | Browser: video plays, seeking works |
| 2 | `GET /media/<execution_id>/audio.mp3` serves audio file | Browser: audio plays |
| 3 | `GET /media/<execution_id>/subtitles.srt` serves subtitle file | Browser: downloads .srt file |
| 4 | **Range requests work** (video seeking) | Chrome DevTools: Network → Range headers sent/accepted |
| 5 | Video plays in job detail page (`/jobs/:id`) | Browser: navigate to job, video plays |
| 6 | Media root configurable via `FYI_MEDIA_ROOT` | Change env var, restart, verify new path |
| 7 | 404 for non-existent files | `curl /media/nonexistent/file.mp4` → 404 |
| 8 | Directory listing works in dev mode | Browser: `/media/` shows execution dirs |
| 9 | TypeScript compiles | `pnpm run typecheck` passes |

---

## 4. Testing Range Requests

```bash
# Test Range request support
curl -H "Range: bytes=0-1023" http://localhost:3001/media/<execution_id>/video.mp4 -I
# Should return: HTTP 206 Partial Content, Content-Range, Accept-Ranges: bytes
```

---

## 5. Implementation Notes

- **`@fastify/static` handles Range requests automatically** — no custom code needed
- **Media root** defaults to `/tmp/fyi-studio` (matches worker output path)
- **Execution ID extraction** from artifact URLs assumes pattern `/fyi-studio/<execution_id>/`
- **Cache headers** set for media files (1 hour) with `Accept-Ranges: bytes`
- **Dev-only directory listing** for debugging — guarded by `NODE_ENV`

---

## 6. Definition of Done

- [ ] `mediaRoutes` registered in Fastify app
- [ ] Video plays in browser with seeking
- [ ] Audio plays in browser
- [ ] Subtitles downloadable
- [ ] Range requests work (verified via curl)
- [ ] Job detail page shows playable video
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run build` passes

---

## 7. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Architecture:** [dashboard-architecture.md](../architecture/dashboard-architecture.md)
- **Previous Issues:** [Issue-701.md](./Issue-701.md), [Issue-702.md](./Issue-702.md), [Issue-703.md](./Issue-703.md)