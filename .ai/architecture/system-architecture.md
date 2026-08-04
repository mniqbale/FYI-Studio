---
id: system-architecture
title: FYI Studio System Architecture
owner: Principal Architect
status: Approved
version: 1.0.0
last_updated: "2026-08-04"
review_cycle: quarterly
tags: [architecture, system-design, orchestrator, worker-pattern, hub-and-spoke]
related_documents:
  - microkernel-architecture.md
  - mvp-architecture.md
  - architecture-manifesto.md
  - contracts.md
related_adr: []
related_sprint: []
---

# Purpose

This document captures the foundational system architecture for FYI Studio as a Distributed Media Manufacturing Plant. It defines the Hub-and-Spoke Orchestrator pattern, Worker Architecture, data flow, storage strategy, and all core infrastructure decisions.

# Background

FYI Studio is an AI Operating System for Distributed Media Production. The system must manage 100+ channels with different brand voices without cross-contamination of logic, while maintaining deterministic orchestration over stochastic workers.

# Architecture Overview

## 1. System Architecture: The "Hub-and-Spoke" Orchestrator

We will use an **Event-Driven Orchestration** pattern.

### Rationale

Unlike a "Chained" architecture where Worker A calls Worker B, a Hub-and-Spoke model ensures that the **FYI Studio Core** (The CEO) maintains full state awareness. If a Worker fails, the system doesn't collapse; the CEO handles the retry or re-routes the task.

### Trade-off

It increases the complexity of the central Orchestrator, but it is the only way to manage 100+ channels with different brand voices without cross-contamination of logic.

## 2. Worker Architecture: The "Standardized Unit"

Every Worker (Research, Voice, etc.) is a **Stateless Adapter**.

### Interface

Every worker must implement a standard API: `POST /execute`.

### Input

A "Context Packet" (JSON) containing only the data required for that specific task.

### Output

A "Result Packet" (JSON) with the work performed and metadata (tokens used, latency, provider info).

### Rationale

This allows us to swap an OpenAI-based Research Worker for a Perplexity-based one in 5 minutes without changing a single line of core logic.

## 3. Data Flow Diagram (Conceptual)

1. **Trigger:** User/Schedule initiates a `ProductionPipeline`.
2. **Orchestrator:** Fetches the `BrandProfile` and `WorkflowTemplate`.
3. **Job Queue:** Orchestrator pushes `Task 1: Research` to the Queue.
4. **Worker:** Research Worker picks it up, executes via External API, returns JSON.
5. **State Store:** Orchestrator saves results to the `Job Ledger`.
6. **Recursive Loop:** Orchestrator evaluates the next step in the DAG (Directed Acyclic Graph) until the `Publisher Worker` confirms completion.

## 4. Database Design: The "Triple-Layer" Storage

| Layer | Technology | Purpose |
|-------|------------|---------|
| Relational | PostgreSQL | For the "CEO's Ledger." Jobs, Task Status, User Accounts, Channel Configurations, and Billing. |
| Document | JSON/NoSQL | For "Artifacts." Storing the raw outputs of every step (e.g., the full research document, the script versions). |
| Vector | Pinecone/Milvus | The "Knowledge Layer." Long-term memory of what content performed well, brand voice nuances, and previous facts to avoid redundant research. |

## 5. Job Queue Design: The "Reliability Engine"

We will use **BullMQ (Redis-backed)** or **Temporal.io**.

### Rationale

We need **long-running task support.** A video render might take 10 minutes. Standard HTTP requests will timeout. Temporal allows for "Workflow as Code," handling retries and state persistence even if the server restarts.

### Priority Queuing

High-priority "Shorts" can bypass a backlog of "Long-form" videos.

## 6. Worker Communication Design: "Zero-Knowledge Protocol"

Workers communicate via an **Envelope Pattern**.

- The Orchestrator wraps data in an "envelope."
- The Worker only sees what's inside.
- The Worker stamps the envelope and sends it back.
- **No Direct Communication:** If the Script Writer needs the Research, it asks the Orchestrator. This prevents "Spaghetti dependencies."

## 7. API Design: "Internal vs. External"

- **Internal API:** Private gRPC or REST endpoints for Worker-Orchestrator communication.
- **External API:** A secure Gateway for the Dashboard (Next.js/React) to monitor progress and for 3rd party webhooks (YouTube/TikTok) to report back analytics.

## 8. Memory Design: The "Context Injection" Strategy

To minimize costs, we use **Just-In-Time (JIT) Context**.

- **Global Memory:** Brand guidelines, "Never use these words" list.
- **Short-term Memory:** The specific research for *this* video.
- **Mechanism:** FYI Studio assembles a "System Prompt" dynamically for each worker by pulling only the relevant snippets from the Knowledge Layer. We never send the whole history.

## 9. Security Design: "Least Privilege"

- Each Worker has its own API Keys (stored in AWS Secrets Manager or HashiCorp Vault).
- The Script Writer doesn't have the YouTube API Key. Only the **Publisher Worker** does.
- **Tenant Isolation:** Data for Channel A is logically separated from Channel B at the Database Query level.

## 10. Cost Optimization Strategy: "The Multi-Tiered Brain"

- **Routing:** Use GPT-4o for "Creative Scripting." Use Llama 3 (via Groq) for "JSON Formatting" or "Summarization."
- **Caching:** If two channels in the same niche ask for "Trending Tech News," the Research Worker returns a cached result for the next 4 hours.
- **Token Pruning:** Automated cleaning of inputs to remove "fluff" before sending to expensive LLMs.

## 11. Scalability Strategy: "Horizontal Worker Scaling"

- The Orchestrator is a lightweight container.
- Workers are deployed as **Serverless Functions (AWS Lambda)** or **Auto-scaling K8s clusters.**
- If we go from 1 channel to 100, we simply increase the "Worker Instances." The "CEO" (Orchestrator) remains the same.

## 12. Deployment Strategy: "Infrastructure as Code"

- **Terraform/Pulumi:** To define the infrastructure.
- **CI/CD:** Each Worker has its own pipeline. We can update the "Subtitle Worker" without touching the "Voice Worker."

## 13. Folder Structure (Monorepo approach)

```text
/apps
  /studio-api (Orchestrator Core)
  /studio-dashboard (UI)
/workers
  /researcher
  /scriptwriter
  /voice-gen
  /video-composer
/packages
  /shared-schema (Zod/JSON Schema)
  /database-client
  /logger
/infrastructure
  /terraform
```

## 14. Roadmap

- **Milestone 1:** Core Orchestrator + Job Queue + Simple Script Worker (Proof of Concept).
- **Milestone 2:** Knowledge Layer + Memory Management.
- **Milestone 3:** Media Workers (Voice/Video/Subtitles).
- **Milestone 4:** Multi-Tenant Brand Management (100+ Channels).
- **Milestone 5:** Analytics & Learning Loop (Auto-optimization).

# Decision Request

**Do you approve this architectural approach, specifically the decision to use a Centralized Orchestrator with a Stateless Worker Adapter pattern?**

If approved, the next phase is **Phase 2: Defining the Schema and the Job Lifecycle.**

# References

- Concept-1.md (source conversation)
- microkernel-architecture.md (evolution)
- mvp-architecture.md (implementation)
- architecture-manifesto.md (governing principles)