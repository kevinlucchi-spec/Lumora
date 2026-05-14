# API Route & Service Design

## Conventions

- All routes return `{ data, error }` envelope
- Auth checked at route level via `getSession()` — unauthenticated → 401
- Ownership checked in service layer — unauthorized → 403
- Zod validation on all request bodies — invalid → 400 with field errors
- Services own DB access — routes never call Prisma directly
- Errors are typed: `AppError extends Error { code: string, status: number }`

---

## Route Summary

### Series
```
GET    /api/series                     → list user's series
POST   /api/series                     → create series
GET    /api/series/[id]                → get series + branches summary
PATCH  /api/series/[id]                → update name, description, sharePolicy
DELETE /api/series/[id]                → soft delete

GET    /api/series/[id]/characters     → list character instances
POST   /api/series/[id]/characters     → add character instance from template
```

### Branches
```
GET    /api/series/[id]/branches       → list branches (included in series GET)
POST   /api/series/[id]/branches       → create branch (fork or main)
GET    /api/branches/[id]              → branch detail + volumes + stories
PATCH  /api/branches/[id]              → update name, description
DELETE /api/branches/[id]              → delete (requires no downstream stories)
```

### Stories
```
GET    /api/branches/[id]/stories      → list stories in branch
GET    /api/stories/[id]               → full story with pages + images
PATCH  /api/stories/[id]               → update title, sharePolicy
DELETE /api/stories/[id]               → delete story
POST   /api/stories/[id]/fork          → create new branch from this story
```

### Generation
```
POST   /api/generate                   → enqueue generation job
       body: StoryGenerationRequest
       returns: { runId: string }

GET    /api/generate/[runId]/status    → poll job status + progress
       returns: { status, currentStep, progress, completedAt?, storyId? }
```

### Library (user's own templates)
```
GET    /api/library/characters         → list user's character templates
POST   /api/library/characters         → create template
GET    /api/library/characters/[id]    → get template
PATCH  /api/library/characters/[id]    → update template, sharePolicy
DELETE /api/library/characters/[id]    → delete template

(same pattern for /worlds, /art-styles, /prompt-seeds)
```

### Discover (public assets)
```
GET    /api/discover?type=character&tags=wizard&page=1
       → paginated list of public assets

GET    /api/discover/[type]/[id]
       → preview a specific shareable asset
```

### Import
```
POST   /api/import
       body: { assetType: string, assetId: string }
       → imports a PUBLIC_REUSE/REMIX asset into user's library
       → creates local copy + provenance record
```

### Generation Runs (debug)
```
GET    /api/runs/[runId]               → full run detail (owner only)
```

---

## Service Contracts

### SeriesService
```typescript
createSeries(userId, input: CreateSeriesInput): Promise<Series>
getSeries(userId, seriesId): Promise<SeriesWithBranches>
updateSeries(userId, seriesId, input): Promise<Series>
deleteSeries(userId, seriesId): Promise<void>
listSeries(userId): Promise<Series[]>
```

### StoryService
```typescript
createStoryFromRun(runId, output: PipelineOutput): Promise<Story>
getStory(userId, storyId): Promise<StoryWithAssets>
updateStory(userId, storyId, input): Promise<Story>
deleteStory(userId, storyId): Promise<void>
forkBranch(userId, storyId, branchName): Promise<Branch>
```

### CharacterService
```typescript
createTemplate(userId, input): Promise<CharacterTemplate>
updateTemplate(userId, templateId, input): Promise<CharacterTemplate>
deleteTemplate(userId, templateId): Promise<void>
addInstanceToSeries(userId, seriesId, templateId): Promise<CharacterInstance>
getInstancesForSeries(userId, seriesId): Promise<CharacterInstance[]>
```

### GenerationService
```typescript
enqueueGeneration(userId, request: StoryGenerationRequest): Promise<string>  // returns runId
getRunStatus(userId, runId): Promise<GenerationRunStatus>
getRunDetail(userId, runId): Promise<GenerationRun>
```

### ShareService
```typescript
updateSharePolicy(userId, entityType, entityId, policy: SharePolicy): Promise<void>
discoverAssets(query: DiscoverQuery): Promise<PaginatedResult<SharedAsset>>
importAsset(userId, assetType, assetId): Promise<ImportedAsset>
```

### AccessControl
```typescript
assertOwnership(userId, entity: OwnedEntity): void           // throws 403 if not owner
assertCanRead(userId, entity: SharableEntity): void          // throws 403 if private
assertCanImport(userId, entity: SharableEntity): void        // throws 403 if not reusable
```

---

## Error Codes

```typescript
const ERROR_CODES = {
  NOT_FOUND: "NOT_FOUND",                          // 404
  FORBIDDEN: "FORBIDDEN",                          // 403
  UNAUTHORIZED: "UNAUTHORIZED",                    // 401
  VALIDATION_ERROR: "VALIDATION_ERROR",            // 400
  PIPELINE_FAILED: "PIPELINE_FAILED",              // 500
  PROVIDER_ERROR: "PROVIDER_ERROR",                // 502
  RATE_LIMITED: "RATE_LIMITED",                    // 429
  IMPORT_NOT_ALLOWED: "IMPORT_NOT_ALLOWED",        // 403
  ASSET_NOT_SHAREABLE: "ASSET_NOT_SHAREABLE",      // 403
} as const
```
