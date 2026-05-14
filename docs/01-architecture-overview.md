# Architecture Overview — Storytime Platform

## System Character

Storytime is a **private-first, multi-AI bedtime story platform** designed as a story universe engine, not a story generator. The distinction matters architecturally: the system must maintain continuity state, branch inheritance, character identity across time, and permissioned sharing — not just produce text.

---

## High-Level System Diagram

```
Browser (Next.js App Router)
         │
         ▼
  API Routes (Next.js)
         │
    ┌────┴────┐
    │  Auth   │  (NextAuth.js — session management)
    └────┬────┘
         │
    ┌────┴────────────┐
    │  Service Layer  │  (typed business logic, no raw DB/AI calls)
    └────┬────────────┘
         │
    ┌────┴────────────────────────────────────────┐
    │                                              │
    ▼                                              ▼
PostgreSQL (Prisma)                    Redis + BullMQ
(persistent state)                     (job queues)
                                              │
                                              ▼
                                    Orchestration Pipeline
                                    (multi-step, loggable)
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                        AI Providers    Image Providers   S3 Storage
                    (Claude/OAI/Gemini/xAI)  (DALL·E/etc)  (assets)
```

---

## Key Architectural Principles

1. **Services own business logic** — API routes are thin. They validate input (Zod), call a service, return a response. No raw Prisma or AI calls in route handlers.

2. **Provider abstraction owns all AI calls** — No raw `anthropic.messages.create()` scattered in code. Every AI interaction goes through a typed provider adapter registered to a capability.

3. **Pipeline owns orchestration** — Story generation is a multi-step, logged, retry-capped pipeline. Steps are discrete functions. Each step emits structured output and a log entry.

4. **Three memory layers are first-class** — Character memory, branch/story memory, and world/canon memory are separate data structures with separate retrieval paths. Context assembly reads from all three.

5. **Shareability is a policy, not a flag** — Every shareable entity carries a `SharePolicy` enum and optional provenance reference. Imports copy the entity and preserve attribution. Private continuity state is never exported.

6. **Generation runs are fully auditable** — Every pipeline execution writes a `GenerationRun` record with per-step logs, provider metadata, validation reports, and token usage.

---

## Request Lifecycle (Story Generation)

```
User submits story request
    │
    ▼
API Route validates with Zod
    │
    ▼
Service enqueues GenerationJob in BullMQ
    │
    ▼
Worker picks up job → Pipeline begins
    │
    ├── 01 normalize-request
    ├── 02 retrieve-context (3 memory layers)
    ├── 03 generate-outline        (Claude)
    ├── 04 validate-outline        (OpenAI)
    ├── 05 repair-outline          (Claude, if needed, max 2x)
    ├── 06 generate-story-draft    (Claude)
    ├── 07 validate-story          (OpenAI)
    ├── 08 repair-story            (Claude, targeted, max 2x)
    ├── 09 extract-scene-specs     (Gemini)
    ├── 10 validate-scenes         (internal schema check)
    ├── 11 generate-images         (image provider, per scene)
    ├── 12 image-qa                (Gemini, optional)
    ├── 13 update-memory-state     (character + branch memory)
    ├── 14 persist-all-outputs     (Story, SceneSpecs, ImageAssets, RunLog)
    └── 15 notify-client           (SSE or polling)
```

---

## Subsystem Responsibilities

| Subsystem | Responsibility |
|-----------|---------------|
| `lib/providers/ai` | All LLM calls, normalized by capability |
| `lib/providers/image` | All image generation calls |
| `lib/pipeline` | Step-by-step orchestration, logging, retry logic |
| `lib/memory` | Context assembly from 3 memory layers |
| `lib/validation` | Story, outline, continuity, scene validators |
| `lib/schemas` | Zod schemas for all major artifacts |
| `lib/services` | Business logic (series, stories, characters, sharing) |
| `lib/queue` | BullMQ setup, job definitions, worker registration |
| `prisma/schema.prisma` | All persistent data models |
| `src/app/api` | Thin route handlers (validate → service → respond) |
| `src/app/(app)` | Authenticated frontend routes |
| `src/app/(auth)` | Login/register routes |
