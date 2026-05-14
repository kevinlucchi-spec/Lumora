# Tech Stack & Rationale

## Core Framework

| Choice | Rationale |
|--------|-----------|
| **Next.js 14 (App Router)** | Full-stack in one repo. RSC for data-heavy pages, route handlers for API, streaming for generation progress. No need for a separate Express/Fastify backend at MVP scale. |
| **TypeScript (strict)** | Non-negotiable for a system with this many interacting AI artifacts and JSON contracts. |
| **React 18** | Concurrent features, Suspense for loading states, streaming-compatible. |

## Database

| Choice | Rationale |
|--------|-----------|
| **PostgreSQL** | Relational integrity matters here — series → branch → volume → story is a tree, and character/world relationships need FK enforcement. JSON columns handle flexible AI artifact storage without fighting the schema. |
| **Prisma** | Type-safe ORM, excellent migration tooling, good Zod interop via `prisma-zod-generator`. Avoids raw SQL for CRUD while keeping full SQL access available for complex queries. |

## Queuing & Background Work

| Choice | Rationale |
|--------|-----------|
| **Redis** | Required for BullMQ. Also used for session caching and rate limiting. |
| **BullMQ** | Production-grade queue. Supports priorities, delayed jobs, retry with backoff, job events, and named queues. Story generation is inherently async (multiple AI calls, 15-30s+). |

## AI Providers

| Provider | Role |
|----------|------|
| **Anthropic (Claude 3.5 Sonnet / Claude 3 Haiku)** | Primary story writer. Best long-form narrative quality. Haiku for fast repair loops. |
| **OpenAI (GPT-4o / GPT-4o-mini)** | Structured validator and continuity checker. Excellent at JSON schema compliance and logical contradiction detection. |
| **Google (Gemini 1.5 Flash / Pro)** | Visual director and scene extractor. Multimodal capability for image-prompt construction and image QA. |
| **xAI (Grok)** | Critic, ranker, and variant generator. Used optionally for quality comparison and alternate suggestions. |
| **Image (DALL·E 3 / Stability AI)** | Scene illustration. DALL·E 3 for quality, Stability for volume/cost control. Pluggable. |

## Storage

| Choice | Rationale |
|--------|-----------|
| **S3-compatible (AWS S3 or Cloudflare R2)** | Image assets and generation artifacts. Cloudflare R2 preferred for cost (no egress fees). |

## Auth

| Choice | Rationale |
|--------|-----------|
| **NextAuth.js v5 (Auth.js)** | First-class Next.js integration. Supports email/magic-link for MVP, OAuth later. Session stored in JWT or database sessions. |

## Validation

| Choice | Rationale |
|--------|-----------|
| **Zod** | Runtime schema validation for all AI-generated artifacts, API inputs, and JSON contracts. Schema-first design — Zod schemas are the source of truth for TypeScript types. |

## UI

| Choice | Rationale |
|--------|-----------|
| **Tailwind CSS** | Utility-first, consistent, fast to iterate. |
| **shadcn/ui** | Unstyled-by-default component primitives. Owned in the repo, not a dependency black box. Accessible. |
| **Lucide React** | Icon set. Consistent with shadcn/ui. |

## Dev Tools

| Tool | Use |
|------|-----|
| **ESLint + Prettier** | Code quality and formatting |
| **Vitest** | Unit tests for validators, schema checks, pipeline steps |
| **Playwright** | E2E tests for critical flows |
| **Prisma Studio** | DB inspection during development |

## Environment Strategy

- All secrets in `.env.local` (never committed)
- Public env vars prefixed `NEXT_PUBLIC_`
- Server-only env validated at startup with Zod (`src/lib/env.ts`)
- Separate `.env.test` for test environment
