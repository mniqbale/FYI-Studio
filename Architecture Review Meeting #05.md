# Architecture Review Meeting #05
## Subject:
Re-evaluation of FYI Studio Milestone 2 after the emergence of the "Bring Your Own AI (BYOAI)" concept.

Before continuing implementation, I want to pause development and perform an Architecture Review.

This is NOT a coding request.

This is NOT an implementation request.

This is an Engineering Decision Review.

=========================================================
BACKGROUND
=========================================================

During Sprint 1 we successfully established the Skeleton Run architecture.

The current roadmap defines:

Milestone 1
→ Skeleton Run

Milestone 2
→ (Documentation inconsistency)

Some documents define Milestone 2 as:

"The Cognitive Core"
(real AI providers replacing mock workers)

while the current roadmap defines Milestone 2 as

"Knowledge Layer + Memory Management."

During our architecture discussion I realized a new concept has emerged which was not explicitly represented in the roadmap.

The concept is:

Bring Your Own AI (BYOAI)

=========================================================
NEW PRODUCT INSIGHT
=========================================================

I no longer believe FYI Studio should be viewed only as an AI Video Factory.

The product direction appears to be evolving toward:

"An AI Orchestration Platform for Creative Production."

This changes how I think about Milestone 2.

=========================================================
PROBLEM
=========================================================

Both current Milestone 2 options assume AI providers are already available.

However, users currently have no standardized way to:

• connect their own AI providers

• manage API Keys

• choose models

• define provider preferences

• define capability routing

• switch providers

• manage health status

• manage quotas

• manage secrets

Without this foundation, every worker risks becoming tightly coupled to specific providers.

=========================================================
PROPOSED ARCHITECTURAL CHANGE
=========================================================

Instead of immediately implementing either:

A.
The Cognitive Core

or

B.
Knowledge Layer

I want us to evaluate introducing a brand new foundational milestone.

Working title:

Milestone 2
AI Platform Foundation

This milestone would establish the AI infrastructure used by every future worker.

=========================================================
PROPOSED SCOPE
=========================================================

The proposed milestone would include concepts such as:

• Provider Registry

(OpenAI
Claude
Gemini
OpenRouter
Groq
Ollama
Azure
Vertex
Together
etc.)

--------------------------------

• Connection Manager

API Keys

Health Status

Quota

Secret Storage

Connection Validation

--------------------------------

• Model Registry

Provider

Model

Version

Pricing

Capabilities

Context Window

Status

--------------------------------

• Capability Registry

Reasoning

Vision

Image

Speech

Embedding

Video

Tool Calling

Search

Structured Output

etc.

--------------------------------

• ModelGate v2

Instead of static mapping,

Workers ask for a Capability.

ModelGate resolves:

Connected Providers

↓

Available Models

↓

Policy

↓

Capability Match

↓

Selected Model

--------------------------------

• Default Provider Policies

Every Worker has recommended default models,

but users are free to override them using only compatible models.

For example:

Research Worker

Default

Gemini 2.5 Pro

User may switch to

Claude Sonnet

or

OpenAI

or

Ollama

provided the selected model satisfies the required capabilities.

=========================================================
IMPORTANT
=========================================================

This proposal is NOT requesting implementation.

I want an architectural discussion.

Specifically I want you to evaluate:

1.

Should this become an independent milestone?

2.

Should it become part of Cognitive Core?

3.

Should it become part of Knowledge Layer?

4.

Would introducing this layer simplify or complicate the architecture?

5.

How would this affect existing ADRs?

6.

How would this affect Contracts?

7.

How would this affect Engineering Standards?

8.

Would introducing this layer reduce future technical debt?

9.

Does this improve long-term scalability?

10.

Would you recommend changing the roadmap?

=========================================================
REQUEST
=========================================================

Please perform an Architecture Review instead of implementation.

Think as:

• Principal Architect

• CTO

• Platform Engineer

• Product Architect

Challenge this proposal.

Identify weaknesses.

Identify hidden complexity.

Identify long-term consequences.

If you believe this proposal is fundamentally stronger than the current roadmap,

recommend how the roadmap should evolve.

If you disagree,

explain why.

=========================================================
IMPORTANT CONSTRAINT

Do NOT generate code.

Do NOT generate implementation.

Do NOT modify documentation.

This session is purely an architectural review.

Once we reach consensus,

the Documentation Architect (Nemotron) will update the repository documentation accordingly.