---
id: sprint-008-issue-804
title: "Issue 8.4 — Dashboard Polish: Readable Artifacts + References + Download JSON"
owner: "Lead Engineer (AI Agent)"
status: "proposed"
version: "1.0.0"
last_updated: "2026-08-06"
review_cycle: "per-issue"
tags: [sprint-008, issue-804, dashboard, artifacts, references, bibliography, download-json, polish]
related_documents:
  - "README.md"
  - "dashboard-architecture.md"
  - "settings-ai-workspace-architecture.md"
  - "Issue-801.md"
related_sprint: "Sprint-008"
---

# Issue 8.4 — Dashboard Polish: Readable Artifacts + References + Download JSON

> **Sprint:** 8 (Milestone 9: Settings AI Workspace — Workstream D Dashboard polish)  
> **Estimate:** M (3-5 hours)  
> **Dependencies:** Issue 8.1 (Scaffold)  
> **Blockers:** None

---

## 1. Objective

Apply the **Dashboard polish (Workstream D)** requested in the Founder's review feedback:
- **(6)** Show job artifacts as **human-readable text, not raw JSON**, with a **"Download JSON"** button (all artifacts as a zip, or individual).
- **(7)** Add a **References/Bibliography** section on `/jobs/:id` showing the research sources used.

These are **read-only** display improvements to the existing `services/dashboard` — no write operations here (Revise/Approve is Issue 8.5).

---

## 2. Deliverables

### 2.1 `services/dashboard/src/utils/artifacts.ts` (Readable formatter + zip)

```typescript
// services/dashboard/src/utils/artifacts.ts
import JSZip from 'jszip';

// Convert a raw artifact object into a list of human-readable sections
export function artifactsToSections(artifacts: Record<string, any>): { label: string; body: string }[] {
  const sections: { label: string; body: string }[] = [];
  for (const [key, value] of Object.entries(artifacts ?? {})) {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    sections.push({ label: key, body: text });
  }
  return sections;
}

// Build a ZIP of all artifacts as individual JSON files
export async function buildArtifactsZip(jobId: string, artifacts: Record<string, any>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [key, value] of Object.entries(artifacts ?? {})) {
    zip.file(`${key}.json`, JSON.stringify(value, null, 2));
  }
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
}
```

### 2.2 `services/dashboard/src/routes/jobs.ts` (UPDATED — add download endpoints)

```typescript
// services/dashboard/src/routes/jobs.ts (excerpt — additions)
import { buildArtifactsZip } from '../utils/artifacts.js';

// Download all artifacts as a zip
app.get('/api/jobs/:id/artifacts.zip', async (req, reply) => {
  const { id } = req.params as { id: string };
  const job = await prisma.job.findUniqueOrThrow({ where: { id } });
  const zip = await buildArtifactsZip(id, job.artifacts);
  reply.type('application/zip').header('Content-Disposition', `attachment; filename="${id}-artifacts.zip"`);
  return reply.send(zip);
});

// Download a single artifact as JSON
app.get('/api/jobs/:id/artifacts/:key.json', async (req, reply) => {
  const { id, key } = req.params as { id: string; key: string };
  const job = await prisma.job.findUniqueOrThrow({ where: { id } });
  const value = job.artifacts?.[key];
  return reply.type('application/json').send(value);
});
```

### 2.3 `services/dashboard/src/templates/job-detail-partials/artifacts.ts` (human-readable render)

```typescript
// services/dashboard/src/templates/job-detail-partials/artifacts.ts
import { artifactsToSections } from '../../utils/artifacts.js';

export function renderArtifacts(jobId: string, artifacts: Record<string, any>) {
  const sections = artifactsToSections(artifacts);
  return `
    <section id="artifacts">
      <h2>Artifacts</h2>
      <a href="/api/jobs/${jobId}/artifacts.zip" download>⬇ Download All (ZIP)</a>
      ${sections.map(s => `
        <details>
          <summary>${s.label}</summary>
          <pre>${escapeHtml(s.body)}</pre>
          <a href="/api/jobs/${jobId}/artifacts/${s.label}.json" download>Download JSON</a>
        </details>`).join('')}
    </section>`;
}
```

### 2.4 `services/dashboard/src/templates/job-detail-partials/references.ts` (Bibliography)

```typescript
// services/dashboard/src/templates/job-detail-partials/references.ts
export function renderReferences(artifacts: Record<string, any>) {
  // Research sources live in artifacts.research.sources (array of URLs/refs)
  const sources = artifacts?.research?.sources ?? [];
  if (!sources.length) return '';
  return `
    <section id="references">
      <h2>References / Bibliography</h2>
      <ol>${sources.map((s: string) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
    </section>`;
}
```

### 2.5 Wire into `job-detail.ts` template

Add `renderArtifacts(...)` and `renderReferences(...)` into the `/jobs/:id` page body, replacing the raw `JSON.stringify(job.artifacts)` output.

---

## 3. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `/jobs/:id` shows artifacts as human-readable text (not raw JSON) | Visual check |
| 2 | "Download All (ZIP)" downloads a valid zip of artifact JSONs | Manual: unzip works |
| 3 | Individual "Download JSON" per artifact works | Manual: file downloads |
| 4 | `/jobs/:id` shows References/Bibliography section from research sources | Visual check (list of sources) |
| 5 | No write operations (read-only display + download) | Code review |
| 6 | `pnpm run typecheck` + `pnpm run build` pass | CI check |

---

## 4. Implementation Notes

- **Read-only** — this issue only renders artifacts and serves downloads; no DB writes (writes are Issue 8.5 / ADR-0010).
- **References source** — research sources are read from `artifacts.research.sources` (the array of source URLs/refs produced by the research worker).
- **JSZip** — add `jszip` dependency to `services/dashboard` for the zip download. If Anti-Monster-minimal is preferred, a manual zip alternative (or individual-downloads-only) can be chosen; the "all as a zip" is the requested default.

---

## 5. Definition of Done

- [ ] Artifacts shown as human-readable text with per-artifact Download JSON
- [ ] "Download All (ZIP)" works
- [ ] References/Bibliography section present on `/jobs/:id`
- [ ] No write operations introduced
- [ ] Typecheck/build pass; unit tests for formatter (≥80%)

---

## 6. Cross-References

- **Sprint Plan:** [README.md](./README.md)
- **Dashboard Architecture:** [dashboard-architecture.md](../architecture/dashboard-architecture.md)
- **ADR-0010 (write exception — approve/revise in Issue 8.5):** [../../adr/ADR-0010-hitl-revise-approve.md](../../adr/ADR-0010-hitl-revise-approve.md)
