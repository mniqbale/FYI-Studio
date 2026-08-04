---
id: ADR-0003-reference-based-data-plane
title: "Reference-Based Data Plane (S3 Pointers Only)"
status: "Accepted"
date: "2026-08-04"
deciders: ["CTO", "Principal Engineer", "SRE"]
tags: [data-plane, s3, binary-data, egress, architecture, mvp]
source_conversation: "Concept-4.md (CTO Critique: Data Gravity), Concept-5.md (MVP Data Plane)"
---

# ADR-0003: Reference-Based Data Plane (S3 Pointers Only)

## Context

During the CTO's brutal assessment of the Manifesto (Concept-4), a critical flaw was identified in the "Context Bus" design:

> **The Brutal Reality:** We are a **Media** OS. Media means Gigabytes.
> **The Flaw:** If the Script Worker produces a script, the Voice Worker needs it (Kilobytes). But when the Video Worker produces 2GB of raw footage, and the Subtitle Worker needs to analyze it, are we sending that through the "CEO"?
> **Redesign:** We must move from a "Data Bus" to a **"Reference Bus."** Workers should never pass data; they should pass pointers to shared storage (S3/R2). If we move files through the Orchestrator, our egress costs will bankrupt us before we hit 10 channels.

This was reinforced in the Architecture Review Meeting (Concept-5) where the SRE confirmed: "I already am. The egress alone will bankrupt us."

## Decision

**Mandate a Reference-Based Data Plane for all binary/media data.**

### The Law
> **No binary data (images/video/audio) ever travels through the Orchestrator.**

### Mechanism
1. **Workers write binary output** directly to shared S3/R2 bucket
2. **Workers return URI** (e.g., `s3://bucket/jobs/{job_id}/{execution_id}/output.mp4`) in `WorkerResponse.new_references`
3. **Orchestrator passes URI** to next Worker via `TaskEnvelope.references`
4. **Downstream Worker downloads** from S3/R2 directly when needed
5. **Orchestrator never sees, buffers, or transforms** binary content

### Implementation Details

#### Worker Contract (references field)
```typescript
// TaskEnvelope (input)
references: Record<string, string>;  // e.g., { "raw_audio_url": "s3://bucket/..." }

// WorkerResponse (output)
new_references: Record<string, string>;  // e.g., { "generated_video_url": "s3://bucket/..." }
```

#### S3 Path Convention
```
s3://{bucket}/jobs/{job_id}/{execution_id}/{artifact-name}.{ext}
```
- Includes `execution_id` for idempotency (prevents overwrite on retry)
- Workers can download only what they need

#### Local Development (MVP)
- Use local `/tmp/fyi-studio/{job_id}/{execution_id}/` instead of S3
- Same URI pattern: `file:///tmp/fyi-studio/...`
- Zero config for local dev

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| **Data Bus (binary through Orchestrator/Redis)** | Egress costs bankrupt us at scale; Redis not built for GB payloads; Orchestrator becomes bottleneck |
| **Shared Volume (NFS/EFS)** | Couples workers to same filesystem; not cloud-native; scaling issues |
| **Message Queue with Large Payloads** | BullMQ/Redis not designed for this; memory pressure; timeouts |
| **Worker-to-Worker Direct Transfer** | Violates "No Direct Worker-to-Worker Communication" axiom; creates spaghetti dependencies |

## Consequences

### Positive
- **Cost Control** — Egress only from S3 to Worker (not through Orchestrator); predictable
- **Scalability** — Workers scale independently; S3 handles throughput
- **Reliability** — If Worker crashes mid-download, retry downloads from S3 (idempotent)
- **Observability** — S3 access logs show exactly what each Worker read/wrote
- **Future-Proof** — Can swap S3 for R2, GCS, Azure Blob without Orchestrator changes

### Negative
- **Extra Hop** — Worker must download from S3 before processing (mitigated: Workers in same region/VPC)
- **S3 Dependency** — Need S3-compatible storage even for local dev (mitigated: local filesystem with `file://` URIs)
- **Permission Management** — Workers need scoped S3 credentials (mitigated: presigned URLs or IAM roles)

## Implementation Notes

1. **MVP:** Use local `/tmp` with `file://` URIs — zero cloud dependency for Sprint 1
2. **S3 Integration:** Milestone 3 (Media Plane) — add real S3/R2 client
3. **Presigned URLs:** For production, Orchestrator generates short-lived presigned URLs for Workers (never shares long-lived credentials)
4. **Cleanup Policy:** TTL-based lifecycle rules on S3 bucket (e.g., delete artifacts after 30 days)
5. **Cross-References:**
   - ADR-0001 (MVP Architecture) — Data Plane is law #3
   - ADR-0002 (Contracts v1.1) — `references` and `new_references` fields
   - Engineering Standards — Idempotency requires `execution_id` in S3 path

---

**Approval:** CTO (identified data gravity risk), Principal Engineer (advocated reference bus), SRE (confirmed egress bankruptcy risk)