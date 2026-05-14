# Folder & File Structure

```
storytime/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   │
│   │   ├── (app)/                        ← authenticated routes
│   │   │   ├── layout.tsx                ← sidebar + auth guard
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── series/
│   │   │   │   ├── page.tsx              ← series list
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [seriesId]/
│   │   │   │       ├── page.tsx          ← series overview
│   │   │   │       ├── canon/page.tsx
│   │   │   │       ├── characters/
│   │   │   │       │   ├── page.tsx
│   │   │   │       │   └── new/page.tsx
│   │   │   │       └── branches/
│   │   │   │           └── [branchId]/
│   │   │   │               ├── page.tsx  ← branch view
│   │   │   │               └── stories/
│   │   │   │                   ├── new/page.tsx
│   │   │   │                   └── [storyId]/
│   │   │   │                       ├── page.tsx    ← reader
│   │   │   │                       └── fork/page.tsx
│   │   │   ├── library/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── characters/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── new/page.tsx
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   ├── worlds/...
│   │   │   │   ├── art-styles/...
│   │   │   │   └── prompt-seeds/...
│   │   │   ├── discover/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [type]/[id]/page.tsx
│   │   │   ├── runs/
│   │   │   │   └── [runId]/page.tsx      ← generation run inspector
│   │   │   └── settings/
│   │   │       ├── page.tsx
│   │   │       └── api-keys/page.tsx
│   │   │
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── series/
│   │   │   │   ├── route.ts              ← GET list, POST create
│   │   │   │   └── [seriesId]/
│   │   │   │       ├── route.ts          ← GET, PATCH, DELETE
│   │   │   │       ├── branches/route.ts
│   │   │   │       └── characters/route.ts
│   │   │   ├── branches/
│   │   │   │   └── [branchId]/
│   │   │   │       ├── route.ts
│   │   │   │       └── stories/route.ts
│   │   │   ├── stories/
│   │   │   │   └── [storyId]/
│   │   │   │       ├── route.ts
│   │   │   │       └── fork/route.ts
│   │   │   ├── generate/
│   │   │   │   ├── route.ts              ← POST enqueue job
│   │   │   │   └── [runId]/status/route.ts ← GET job status
│   │   │   ├── library/
│   │   │   │   ├── characters/route.ts
│   │   │   │   ├── worlds/route.ts
│   │   │   │   ├── art-styles/route.ts
│   │   │   │   └── prompt-seeds/route.ts
│   │   │   ├── discover/
│   │   │   │   └── route.ts             ← GET with filters
│   │   │   └── import/
│   │   │       └── route.ts             ← POST import asset
│   │   │
│   │   ├── layout.tsx                   ← root layout
│   │   └── page.tsx                     ← landing
│   │
│   ├── lib/
│   │   ├── env.ts                        ← Zod-validated env vars
│   │   ├── prisma.ts                     ← Prisma client singleton
│   │   ├── auth.ts                       ← NextAuth config
│   │   │
│   │   ├── providers/
│   │   │   ├── ai/
│   │   │   │   ├── types.ts              ← AIRequest, AIResponse, AIProviderAdapter
│   │   │   │   ├── capabilities.ts       ← CAPABILITY_REGISTRY
│   │   │   │   ├── router.ts             ← AIProviderRouter
│   │   │   │   ├── base-adapter.ts       ← BaseAIAdapter
│   │   │   │   ├── anthropic.ts          ← AnthropicAdapter
│   │   │   │   ├── openai.ts             ← OpenAIAdapter
│   │   │   │   ├── gemini.ts             ← GeminiAdapter
│   │   │   │   ├── xai.ts                ← xAIAdapter
│   │   │   │   └── index.ts              ← instantiates and exports router
│   │   │   └── image/
│   │   │       ├── types.ts
│   │   │       ├── dalle.ts              ← DalleAdapter
│   │   │       ├── stability.ts          ← StabilityAdapter
│   │   │       └── index.ts
│   │   │
│   │   ├── pipeline/
│   │   │   ├── types.ts                  ← PipelineContext, PipelineError
│   │   │   ├── index.ts                  ← runStoryPipeline()
│   │   │   └── steps/
│   │   │       ├── 01-normalize-request.ts
│   │   │       ├── 02-retrieve-context.ts
│   │   │       ├── 03-generate-outline.ts
│   │   │       ├── 04-validate-outline.ts
│   │   │       ├── 05-repair-outline.ts
│   │   │       ├── 06-generate-story-draft.ts
│   │   │       ├── 07-validate-story.ts
│   │   │       ├── 08-repair-story.ts
│   │   │       ├── 09-extract-scene-specs.ts
│   │   │       ├── 10-validate-scenes.ts
│   │   │       ├── 11-generate-images.ts
│   │   │       ├── 12-image-qa.ts
│   │   │       ├── 13-update-memory.ts
│   │   │       └── 14-persist-outputs.ts
│   │   │
│   │   ├── memory/
│   │   │   ├── types.ts                  ← ContextPack, snapshots
│   │   │   ├── character-memory.ts       ← read/write CharacterMemory
│   │   │   ├── branch-memory.ts          ← read/write BranchMemory
│   │   │   └── world-canon.ts            ← read/write WorldCanon
│   │   │
│   │   ├── validation/
│   │   │   ├── types.ts                  ← ValidationReport, ValidationIssue
│   │   │   ├── outline-validator.ts
│   │   │   ├── story-validator.ts
│   │   │   └── continuity-checker.ts
│   │   │
│   │   ├── prompts/
│   │   │   ├── system/
│   │   │   │   ├── story-writer.ts       ← Claude system prompt builder
│   │   │   │   ├── validator.ts          ← OpenAI validator system prompt
│   │   │   │   └── scene-extractor.ts    ← Gemini scene extraction prompt
│   │   │   └── user/
│   │   │       ├── outline.ts
│   │   │       ├── story-draft.ts
│   │   │       └── repair.ts
│   │   │
│   │   ├── schemas/                       ← Zod schemas (source of truth)
│   │   │   ├── story.ts
│   │   │   ├── outline.ts
│   │   │   ├── character.ts
│   │   │   ├── world.ts
│   │   │   ├── scene.ts
│   │   │   ├── generation-run.ts
│   │   │   ├── request.ts
│   │   │   ├── context-pack.ts
│   │   │   └── share.ts
│   │   │
│   │   ├── services/
│   │   │   ├── series.service.ts
│   │   │   ├── branch.service.ts
│   │   │   ├── volume.service.ts
│   │   │   ├── story.service.ts
│   │   │   ├── character.service.ts
│   │   │   ├── world.service.ts
│   │   │   ├── generation.service.ts
│   │   │   ├── share.service.ts
│   │   │   └── access-control.ts
│   │   │
│   │   ├── queue/
│   │   │   ├── client.ts                 ← Redis + BullMQ setup
│   │   │   ├── queues.ts                 ← queue definitions
│   │   │   ├── jobs/
│   │   │   │   └── story-generation.job.ts
│   │   │   └── workers/
│   │   │       └── story-generation.worker.ts
│   │   │
│   │   └── storage/
│   │       └── s3.ts                     ← S3 upload/presign helpers
│   │
│   ├── components/
│   │   ├── ui/                           ← shadcn/ui primitives
│   │   ├── story/
│   │   │   ├── story-reader.tsx
│   │   │   ├── story-page.tsx
│   │   │   └── story-generator-form.tsx
│   │   ├── character/
│   │   │   ├── character-card.tsx
│   │   │   └── character-memory-panel.tsx
│   │   ├── series/
│   │   │   ├── branch-tree.tsx
│   │   │   └── series-card.tsx
│   │   ├── pipeline/
│   │   │   └── pipeline-progress.tsx
│   │   ├── share/
│   │   │   ├── share-policy-badge.tsx
│   │   │   └── share-policy-selector.tsx
│   │   ├── run/
│   │   │   └── run-inspector.tsx
│   │   └── layout/
│   │       ├── sidebar.tsx
│   │       └── topbar.tsx
│   │
│   ├── hooks/
│   │   ├── use-generation-status.ts      ← polls /api/generate/[runId]/status
│   │   └── use-series.ts
│   │
│   └── types/
│       └── index.ts                      ← re-exports from schemas
│
├── workers/
│   └── index.ts                          ← standalone worker process entry point
│
├── docs/                                 ← architecture docs (this folder)
│
├── .env.example
├── .env.local                            ← gitignored
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── prisma/schema.prisma
└── package.json
```

## Notes

- `workers/` runs as a separate process in production (not as a Next.js route)
- `lib/prompts/` keeps all prompt construction logic centralized and versionable
- `lib/schemas/` schemas are imported by both API routes (validation) and pipeline steps (typed parsing)
- `lib/services/` are called by API routes — never call Prisma directly in route handlers
- `components/ui/` is shadcn/ui components — generated, not hand-written
