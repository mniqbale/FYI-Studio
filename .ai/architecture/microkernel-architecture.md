---
id: microkernel-architecture
title: FYI Studio Microkernel Architecture V2
owner: Principal Architect
status: Approved
version: 2.0.0
last_updated: "2026-08-04"
review_cycle: quarterly
tags: [architecture, microkernel, worker-registry, model-router, workflow-engine, plugin-sdk, cost-intelligence, knowledge-layer, hitl]
related_documents:
  - system-architecture.md
  - mvp-architecture.md
  - architecture-manifesto.md
  - contracts.md
related_adr: []
related_sprint: []
---

# Purpose

This document captures the evolution of FYI Studio from a Service-Oriented Architecture to a Microkernel Architecture (the classic OS design). The Core becomes a "dumb" kernel that manages resources (Workers), enforces policies (Model Router), and executes instructions (Workflows) without knowing domain specifics.

# Background

In V1, the architecture was a linear assembly line. V2 transforms the system into a **Central Intelligence Agency** where the Core manages a pool of resources (Workers) and makes real-time decisions based on Brand Policies, Cost, and Quality.

# Architecture Overview

## 1. The Microkernel (The Core)

The Core is responsible for the **Context Bus**. Think of this as the system's memory bus. It moves data between the Registry, the Router, and the Workflow Engine without understanding the content of the data.

## 2. Worker Registry: The "Device Driver" Manager

### Design

Every Worker must provide a `manifest.json` upon registration. This manifest defines its capabilities (e.g., `can_generate_voice`, `supported_languages: ["en", "es"]`), its version, and its endpoint.

### Rationale

This allows us to run multiple versions of the same Worker. We can test "Script Writer v2.1" on 5 channels while keeping "Script Writer v2.0" on the other 95.

### Discovery

The Orchestrator never looks for a URL; it looks for a **Capability**. It asks the Registry: "Give me an available Worker that can handle `subtitle_generation`."

## 3. Model Router: The "Policy-Based" Dispatcher

### Design

This is a middle-tier between the Worker and the AI Provider.

### The Intent Pattern

Workers do not request "GPT-4." They request a **Profile**.

- *Example:* A Worker sends a request for a `CREATIVE_LONG_FORM` profile.
- *Router Logic:* If (Budget = Low) AND (Priority = Normal) → Route to `Llama-3-70B`. If (Budget = High) AND (Quality = Critical) → Route to `Claude-3.5-Sonnet`.

### Rationale

This completely decouples the system from OpenAI, Google, or Anthropic. If a provider changes their terms or goes down, we update one policy in the Router, and the entire OS shifts to a new model instantly.

## 4. Workflow Engine: The "Declarative DAG"

### Design

Workflows are defined in YAML/JSON as **Directed Acyclic Graphs (DAGs)**.

### Conditional Logic

"If Research Quality Score < 0.8, re-run Research, else move to Scripting."

### Rationale

Different brands need different steps. A "Faceless Reddit" channel doesn't need a "Scene Planner," but a "High-End Documentary" channel does. We store these as `ProductionRecipes`.

## 5. Plugin SDK: The "Worker Interface"

### Standardization

To be a "Worker" in FYI Studio, you must implement the **FYI-Interface**.

- `init()`: Register capabilities.
- `execute(payload, context)`: Perform work.
- `telemetry()`: Report token usage, cost, and health.

### Rationale

This allows for a marketplace-style expansion. If we need a "TikTok Trends Worker," we build it as a standalone plugin and "plug" it into the Registry.

## 6. Cost Intelligence Layer: The "Financial Telemetry"

### Design

Every transaction is wrapped in a "Billing Envelope."

### Components

- **Unit Costing:** Tracking the exact USD cost of a single video.
- **Quota Management:** "Stop production for Channel X if they exceed $50/day."

### Rationale

In an AI OS, **Tokens are the new Electricity.** You cannot scale to 100 channels without real-time "Power Consumption" monitoring.

## 7. Knowledge Layer: The "Organizational Brain"

### Design

Divided into **Global, Tenant, and Project** scopes.

| Scope | Content |
|-------|---------|
| Global | General facts, common SEO keywords. |
| Tenant (Brand) | The "Brand Voice," preferred fonts, color palettes, "forbidden topics." |
| Project | The specific research for Video ID #402. |

### Rationale

This prevents "Context Bleed." A "Kids Education" channel should never use the tone of a "True Crime" channel. The Knowledge Layer filters the context based on the Tenant ID.

## 8. Human-in-the-Loop (HITL): The "Interrupt" System

### Design

We treat Human Approval as a **Special Worker**.

### The Wait State

The Workflow Engine can enter a `WAIT_FOR_SIGNAL` state. It sends a notification (Slack/Dashboard), saves the state, and pauses the Job.

### Rationale

This provides "Quality Gates." For high-stakes brands, the "CEO" (Orchestrator) doesn't publish until the "Owner" (Human) signs off.

# Trade-offs and Risks

## 1. Complexity Overhead

By adding a Registry and a Router, a simple "Hello World" video now takes 5-6 internal hops before an LLM is even called.

- *Mitigation:* Use high-performance internal communication (gRPC or optimized Redis streams).

## 2. State Consistency

If a Human-in-the-loop takes 24 hours to approve a script, the "Context" might be stale (e.g., news topics).

- *Mitigation:* Implement "Context Refresh" triggers in the Workflow Engine.

## 3. The "Single Point of Failure"

The Orchestrator is now the brain. If it fails, all 100 channels stop.

- *Mitigation:* The Core must be stateless and horizontally scalable, with the state persisted in a distributed database (PostgreSQL/Redis).

# System Evolution Visualization

- **V1:** A linear assembly line.
- **V2:** A **Central Intelligence Agency.** The Core manages a pool of resources (Workers) and makes real-time decisions based on Brand Policies, Cost, and Quality.

# Decision Request

**Are you satisfied with the "Microkernel" approach where the Core is purely a policy and resource manager?**

If yes, the next phase is **Phase 2: Data Schema Design.** This will include the specific structure of the Job Ledger, the Worker Manifest, and the Knowledge Fragment.

# References

- Concept-2.md (source conversation)
- system-architecture.md (V1 foundation)
- mvp-architecture.md (implementation)
- architecture-manifesto.md (governing principles)