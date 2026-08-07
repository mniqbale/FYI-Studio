// Job detail page — polls /api/jobs/:id, updates status + video source,
// and handles HITL revise (ADR-0010).
import { startPolling } from './polling.js';

const jobId = window.location.pathname.split('/').pop();
const url = `/api/jobs/${jobId}`;

function updateVideo(data) {
  const video = document.getElementById('video-player');
  if (video && data.videoRef && video.src !== data.videoRef) {
    video.src = data.videoRef;
    video.load();
  }
}

function updateStatus(data) {
  const badge = document.querySelector('.job-header .status-badge');
  if (badge && data.job && data.job.status) {
    badge.textContent = data.job.status;
    badge.className = `status-badge status-${data.job.status}`;
  }
  const stepEl = document.querySelector('.job-meta .step-strong');
  if (stepEl && data.job) {
    stepEl.textContent = `${data.job.currentStepIndex}`;
  }
}

startPolling(url, (data) => {
  updateVideo(data);
  updateStatus(data);
}, { intervalMs: 3000 });

// HITL Revise (ADR-0010): reveal the edit form, submit the revised script to
// the step's re-run endpoint, and show the result inline.
document.addEventListener('DOMContentLoaded', () => {
  const reviseBtn = document.getElementById('revise-btn');
  const reviseForm = document.getElementById('revise-form');
  const reviseSubmit = document.getElementById('revise-submit');
  const reviseText = document.getElementById('revise-text');
  const reviseStatus = document.getElementById('revise-status');
  if (!reviseBtn || !reviseForm) return;

  reviseBtn.addEventListener('click', () => {
    reviseForm.hidden = !reviseForm.hidden;
  });

  if (reviseSubmit && reviseText) {
    reviseSubmit.addEventListener('click', async () => {
      reviseStatus.textContent = 'Re-running step…';
      reviseStatus.className = 'key-status validating';
      reviseSubmit.disabled = true;
      // The step to re-run is the one just completed (current_step_index - 1)
      // which produced the script artifact. Approve uses current index, so
      // revise targets the script step at index = current_step_index - 1.
      const resp = await fetch(`/api/jobs/${jobId}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: Number(reviseForm.dataset.step ?? 1),
          input: { script: reviseText.value },
        }),
      });
      const out = await resp.json();
      if (out.ok) {
        reviseStatus.textContent = '✅ Step re-dispatched. Job is running — refreshing…';
        reviseStatus.className = 'key-status ok';
        setTimeout(() => window.location.reload(), 1500);
      } else {
        reviseStatus.textContent = `❌ ${out.error || 'Failed to revise'}`;
        reviseStatus.className = 'key-status err';
        reviseSubmit.disabled = false;
      }
    });
  }
});
