# Runtime Schema Strategy

## Principle

Zod schemas are the **single source of truth** for every structured artifact in the system — they define TypeScript types via `z.infer`, validate API inputs, parse AI outputs, and version JSON contracts.

No `interface Foo {}` hand-written separately from a corresponding `FooSchema`. Types derive from schemas.

---

## Schema Catalog

### Request Schemas
```typescript
// lib/schemas/request.ts

export const StoryGenerationRequestSchema = z.object({
  seriesId: z.string().cuid(),
  branchId: z.string().cuid(),
  volumeId: z.string().cuid(),
  mode: StoryModeSchema,
  ageBand: AgeBandSchema,
  prompt: z.string().min(10).max(2000),
  characterIds: z.array(z.string().cuid()).min(0).max(10),
  artStylePresetId: z.string().cuid().optional(),
  promptSeedId: z.string().cuid().optional(),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  customToneOverride: z.string().max(500).optional(),
  generateImages: z.boolean().default(true),
})

export type StoryGenerationRequest = z.infer<typeof StoryGenerationRequestSchema>
```

### Story Schemas
```typescript
// lib/schemas/story.ts

export const StoryPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string(),
  sceneHint: z.string().optional(),
  imageAssetId: z.string().cuid().optional(),
})

export const StoryContentSchema = z.array(StoryPageSchema)

export const StoryDraftSchema = z.object({
  title: z.string(),
  pages: z.array(StoryPageSchema),
})

export type StoryDraft = z.infer<typeof StoryDraftSchema>
```

### Outline Schema
```typescript
// lib/schemas/outline.ts

export const OutlineSectionSchema = z.object({
  title: z.string(),
  summary: z.string(),
  charactersInvolved: z.array(z.string()),
  conflictLevel: z.enum(["none", "low", "medium"]),
})

export const CharacterArcNoteSchema = z.object({
  characterName: z.string(),
  startState: z.string(),
  endState: z.string(),
  keyMoment: z.string().optional(),
})

export const StoryOutlineSchema = z.object({
  title: z.string(),
  logline: z.string(),
  sections: z.array(OutlineSectionSchema).min(2).max(8),
  characterArcs: z.array(CharacterArcNoteSchema),
  theme: z.string().optional(),
  moral: z.string().optional(),
  endingType: z.enum(["reassuring", "wonder", "lesson", "open"]),
  estimatedPageCount: z.number().int().min(4).max(30),
})

export type StoryOutline = z.infer<typeof StoryOutlineSchema>
```

### Validation Report Schema
```typescript
// lib/schemas/generation-run.ts

export const ValidationIssueSchema = z.object({
  type: z.enum([
    "age-mismatch", "tone-mismatch", "canon-conflict",
    "timeline-conflict", "branch-leakage", "unresolved-prompt",
    "image-scene-mismatch", "excessive-intensity", "character-contradiction",
  ]),
  severity: z.enum(["warning", "error"]),
  location: z.string(),      // e.g. "section 2" or "page 7"
  description: z.string(),
})

export const ValidationReportSchema = z.object({
  phase: z.enum(["outline", "story", "scene"]),
  passed: z.boolean(),
  issues: z.array(ValidationIssueSchema),
  repairSuggestions: z.array(z.object({
    location: z.string(),
    instruction: z.string(),
  })).optional(),
})

export type ValidationReport = z.infer<typeof ValidationReportSchema>
```

### Scene Schema
```typescript
// lib/schemas/scene.ts

export const SceneSpecSchema = z.object({
  order: z.number().int().positive(),
  description: z.string(),
  characters: z.array(z.string()),
  setting: z.string(),
  mood: z.string(),
  lighting: z.string().optional(),
  imagePrompt: z.string().optional(),
  shouldIllustrate: z.boolean().default(true),
})

export type SceneSpec = z.infer<typeof SceneSpecSchema>
```

### Context Pack Schema
```typescript
// lib/schemas/context-pack.ts

export const CharacterMemorySnapshotSchema = z.object({
  characterName: z.string(),
  appearance: z.string(),
  personality: z.string(),
  currentState: z.record(z.string(), z.unknown()),
  recentEvents: z.array(z.string()),
})

export const ContextPackSchema = z.object({
  characterSnapshots: z.array(CharacterMemorySnapshotSchema),
  branchFacts: z.array(z.string()),
  worldRules: z.record(z.string(), z.unknown()),
  toneGuide: z.object({
    mode: StoryModeSchema,
    ageBand: AgeBandSchema,
    maxConflictLevel: z.enum(["none", "low", "medium"]),
    endingStyle: z.string(),
    vocabularyLevel: z.string(),
  }),
  recentStoryTitles: z.array(z.string()),
})

export type ContextPack = z.infer<typeof ContextPackSchema>
```

### Provider Log Schema
```typescript
export const ProviderLogEntrySchema = z.object({
  step: z.string(),
  capability: z.string(),
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  latencyMs: z.number(),
  success: z.boolean(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
})
```

---

## Schema Versioning

Each schema file exports a `VERSION` constant:
```typescript
export const STORY_OUTLINE_SCHEMA_VERSION = "1.0.0"
```

The `GenerationRun.promptVersions` field stores the schema versions used at generation time. This allows safe future migrations — if a schema changes, old runs remain readable with the version they were generated under.

---

## Prisma ↔ Zod Integration

`JSON` columns in Prisma are typed as `JsonValue`. Services parse these with the appropriate Zod schema on read:

```typescript
// In a service
const memory = CharacterMemoryStateSchema.parse(instance.memoryState)
```

This ensures runtime safety even when raw DB values are malleable.
