// Job detail page — polls /api/jobs/:id, updates status + video source.
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
