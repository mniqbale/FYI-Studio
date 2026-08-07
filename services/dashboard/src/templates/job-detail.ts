// Job detail page template — pipeline timeline, human-readable artifacts,
// bibliography (point 7), video player, and JSON download buttons (point 6).
import { renderLayout } from './layout.js';
import type { JobDetailResponse } from '../utils/data.js';
import { humanReadable, extractSources } from '../utils/downloads.js';

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
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
  const artifacts = job.artifacts ?? {};
  const references = (artifacts._references as Record<string, string>) ?? {};
  const sources = extractSources(artifacts);
  const isWaitingApproval = job.status === 'waiting_approval';

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
      ${
        isWaitingApproval
          ? `<div class="hitl-actions">
              <form method="post" action="/api/jobs/${job.id}/approve" class="inline-form" onsubmit="return confirm('Approve this job and continue to the next step?')">
                <button type="submit" class="btn btn-ok">✅ Approve</button>
              </form>
              <button type="button" class="btn" id="revise-btn">✏️ Revise Script</button>
              <div id="revise-form" hidden data-step="${job.currentStepIndex > 0 ? job.currentStepIndex - 1 : 0}">
                <textarea id="revise-text" rows="4" class="revise-textarea">${esc(String((artifacts['text-synthesis:script:real'] as Record<string, unknown> | undefined)?.script ?? (artifacts['text-synthesis:script'] as Record<string, unknown> | undefined)?.script ?? ''))}</textarea>
                <button type="button" class="btn btn-ok" id="revise-submit">Re-run Step</button>
                <span id="revise-status" class="key-status"></span>
              </div>
            </div>`
          : ''
      }
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
                      <span class="step-name">${esc((step as { workerLabel?: string }).workerLabel ?? (step as { worker_label?: string }).worker_label ?? step.id)}</span>
                      <span class="step-capability">${esc(step.capability)}</span>
                    </div>
                  </div>`;
                })
                .join('')
            : '<p>No recipe steps recorded.</p>'
        }
      </div>
    </section>

    ${
      videoRef
        ? `<section class="video-section">
            <h3>Generated Video</h3>
            <video id="video-player" controls class="video-player" src="${esc(videoRef)}"></video>
          </section>`
        : ''
    }

    <section class="artifacts">
      <div class="section-head">
        <h3>Artifacts</h3>
        <div class="download-actions">
          <a href="/jobs/${job.id}/download" class="btn">⬇ Download All (ZIP)</a>
        </div>
      </div>
      <div class="artifacts-grid" id="artifacts-grid">
        ${
          Object.keys(artifacts).length
            ? Object.entries(artifacts)
                .filter(([key]) => key !== '_references')
                .map(([key, value]) => {
                  const mediaRef = (() => {
                    for (const m of mediaUrls) if (isVideo(key) && m.key.includes('video')) return m.url;
                    return null;
                  })();
                  const isMedia = typeof value === 'string' && (value.startsWith('file://') || value.startsWith('/tmp/fyi-studio'));
                  const mediaUrl = mediaRef;
                  const readable = humanReadable(key, value);
                  return `<div class="artifact-card" data-key="${esc(key)}">
                    <div class="artifact-head">
                      <h4>${esc(key)}</h4>
                      <a href="/jobs/${job.id}/download?file=${encodeURIComponent(`artifact-${key}.json`)}" class="btn btn-sm" title="Download ${esc(key)} as JSON">⬇ JSON</a>
                    </div>
                    ${
                      isMedia && mediaUrl && (isAudio(key) || isSubtitle(key))
                        ? (isAudio(key)
                            ? `<audio controls class="audio-player" src="${esc(mediaUrl)}"></audio>`
                            : `<a href="${esc(mediaUrl)}" target="_blank" class="btn">Open ${esc(key)}</a>`)
                        : ''
                    }
                    <p class="artifact-text">${esc(readable)}</p>
                  </div>`;
                })
                .join('')
            : '<p>No artifacts yet</p>'
        }
      </div>
      ${
        Object.keys(references).length
          ? `<details class="references-block">
              <summary>References / Pointers (${Object.keys(references).length})</summary>
              ${Object.entries(references)
                .map(([k, ref]) => {
                  const url = mediaUrls.find((m) => m.key === k)?.url;
                  return `<div class="ref-line"><code>${esc(k)}</code> → <span class="ref-val">${esc(String(ref))}</span>${
                    url ? ` <a href="${esc(url)}" target="_blank" class="btn btn-sm">Open</a>` : ''
                  }</div>`;
                })
                .join('')}
            </details>`
          : ''
      }
    </section>

    ${
      sources.length
        ? `<section class="bibliography">
            <h3>Daftar Pustaka / Referensi (${sources.length})</h3>
            <p class="muted">Sumber rujukan yang dipakai dalam riset konten ini.</p>
            <ol class="source-list">
              ${sources.map((s) => `<li>${esc(s)}</li>`).join('')}
            </ol>
          </section>`
        : ''
    }

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
