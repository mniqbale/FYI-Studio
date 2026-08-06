// Job detail page template — pipeline timeline, per-step artifacts, video player.
import { renderLayout } from './layout.js';
import type { JobDetailResponse } from '../utils/data.js';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

function isVideo(key: string): boolean {
  return /video|mp4|webm/.test(key);
}
function isAudio(key: string): boolean {
  return /audio|voice|mp3|wav|tts/.test(key);
}
function isSubtitle(key: string): boolean {
  return /subtitle|srt|vtt/.test(key);
}

export function renderJobDetailPage(data: JobDetailResponse): string {
  const { job, telemetry, mediaUrls, videoRef } = data;
  const steps = job.recipeSnapshot?.steps ?? [];

  const content = `
    <section class="job-header">
      <h2>${esc(job.id)}</h2>
      <div class="job-meta">
        <span><strong>Tenant:</strong> ${esc(job.tenantId)}</span>
        <span><strong>Recipe:</strong> ${esc(job.recipeId)}</span>
        <span><strong>Status:</strong> <span class="status-badge status-${esc(job.status)}">${esc(job.status)}</span></span>
        <span><strong>Step:</strong> ${job.currentStepIndex}/${steps.length}</span>
        <span><strong>Created:</strong> ${new Date(job.createdAt).toLocaleString()}</span>
        <span><strong>Updated:</strong> ${new Date(job.updatedAt).toLocaleString()}</span>
      </div>
    </section>
    <section class="pipeline-timeline">
      <h3>Pipeline Timeline</h3>
      <div id="timeline" class="timeline">
        ${
          steps.length > 0
            ? steps
                .map((step, i) => {
                  const done = i < job.currentStepIndex;
                  const current = i === job.currentStepIndex && job.status !== 'completed';
                  const cls = done ? 'completed' : current ? 'current' : 'pending';
                  return `<div class="timeline-step ${cls}" data-step="${esc(step.id)}">
                    <div class="step-info">
                      <span class="step-name">${esc(step.workerLabel)}</span>
                      <span class="step-capability">${esc(step.capability)}</span>
                    </div>
                  </div>`;
                })
                .join('')
            : '<p>No recipe steps recorded.</p>'
        }
      </div>
    </section>
    <section class="artifacts">
      <h3>Artifacts</h3>
      <div class="artifacts-grid" id="artifacts-grid">
        ${
          videoRef
            ? `<div class="artifact-card video-card">
                <h4>Generated Video</h4>
                <video id="video-player" controls class="video-player" src="${esc(videoRef)}"></video>
              </div>`
            : ''
        }
        ${
          Object.keys(job.artifacts).length
            ? Object.entries(job.artifacts)
                .map(([key, value]) => {
                  const isRefs = key === '_references';
                  if (isRefs) {
                    const refs = value as Record<string, string>;
                    return `
                      <div class="artifact-card" data-key="${esc(key)}">
                        <h4>${esc(key)}</h4>
                        ${Object.entries(refs)
                          .map(([rk, ref]) => {
                            const url = mediaUrls.find((m) => m.key === rk)?.url;
                            return `<div class="ref-line"><code>${esc(rk)}</code> → <span class="ref-val">${esc(String(ref))}</span>${
                              url ? ` <a href="${esc(url)}" target="_blank" class="btn">Open</a>` : ''
                            }</div>`;
                          })
                          .join('')}
                      </div>`;
                  }
                  const plain = typeof value === 'string' || typeof value === 'number';
                  return `<div class="artifact-card" data-key="${esc(key)}">
                    <h4>${esc(key)}</h4>
                    ${
                      plain
                        ? `<p>${esc(String(value))}</p>`
                        : `<pre>${esc(JSON.stringify(value, null, 2))}</pre>`
                    }
                  </div>`;
                })
                .join('')
            : '<p>No artifacts yet</p>'
        }
      </div>
    </section>
    <section class="telemetry">
      <h3>Telemetry</h3>
      <table class="telemetry-table">
        <thead><tr><th>Worker</th><th>Provider</th><th>Model</th><th>Tokens In</th><th>Tokens Out</th><th>Cost</th><th>Duration</th></tr></thead>
        <tbody id="telemetry-tbody">
          ${telemetry
            .map(
              (t) => `
            <tr>
              <td>${esc(t.workerId)}</td>
              <td>${esc(t.provider ?? '-')}</td>
              <td>${esc(t.model ?? '-')}</td>
              <td>${t.tokensIn ?? '-'}</td>
              <td>${t.tokensOut ?? '-'}</td>
              <td>$${t.cost.toFixed(6)}</td>
              <td>${t.durationMs ?? '-'}ms</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </section>
  `;

  return renderLayout({
    title: `Job ${job.id.slice(0, 8)}`,
    currentPage: 'job-detail',
    content,
    extraHead: '<script type="module" src="/assets/job-detail.js"></script>',
  });
}
