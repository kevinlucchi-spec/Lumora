# Orchestration Pipeline Design

## Philosophy

- Steps are discrete, typed functions with named inputs and outputs
- Each step emits a structured log entry to the `GenerationRun`
- Validation happens before and after generation — not just at the end
- Repair is local: only the failing section is repaired, not the whole story
- Retry/repair loops are capped (max 2 rounds per phase)
- Pipeline continues to PARTIAL completion when non-critical steps fail (e.g., image generation)
- The pipeline is a pure function: `(PipelineContext) => Promise<PipelineContext>`

---

## PipelineContext

```typescript
interface PipelineContext {
  runId: string
  userId: string
  request: StoryGenerationRequest          // raw user input
  normalizedRequest?: NormalizedRequest     // after step 01
  contextPack?: ContextPack                 // after step 02
  outline?: StoryOutline                    // after step 03–05
  storyDraft?: StoryDraft                   // after step 06–08
  sceneSpecs?: SceneSpec[]                  // after step 09–10
  imageAssets?: ImageAsset[]               // after step 11
  finalStory?: Story                        // after step 14
  log: PipelineLogEntry[]                   // accumulated step logs
  errors: PipelineError[]
  status: "running" | "completed" | "failed" | "partial"
}
```

---

## Pipeline Steps

### Step 01: Normalize Request
**Purpose:** Validate and enrich the raw user request. Fill defaults. Resolve references (e.g., expand characterIds to full essence + state).

**Input:** `StoryGenerationRequest`
**Output:** `NormalizedRequest`
**Provider:** None (internal logic + DB lookup)

```typescript
interface StoryGenerationRequest {
  seriesId: string
  branchId: string
  volumeId: string
  mode: StoryMode
  ageBand: AgeBand
  prompt: string
  characterIds: string[]          // CharacterInstance IDs
  artStylePresetId?: string
  promptSeedId?: string
  length?: "short" | "medium" | "long"
  customToneOverride?: string
  generateImages?: boolean
}

interface NormalizedRequest {
  ...StoryGenerationRequest,
  resolvedCharacters: ResolvedCharacter[]  // full essence + current state
  resolvedArtStyle?: ArtStylePresetSpec
  targetWordCount: number                  // derived from length + ageBand
  toneSpec: ToneSpec                       // derived from mode + ageBand
}
```

---

### Step 02: Retrieve Context
**Purpose:** Assemble a `ContextPack` from all three memory layers.

**Input:** `NormalizedRequest`
**Output:** `ContextPack`
**Provider:** None (DB reads)

```typescript
interface ContextPack {
  characterMemories: CharacterMemorySnapshot[]   // from CharacterMemory
  branchFacts: BranchMemorySnapshot             // from BranchMemory
  worldCanon: WorldCanonSnapshot                // from WorldCanon
  recentStories: StorySnapshot[]               // last N stories for continuity
  toneGuide: ToneGuide
}
```

---

### Step 03: Generate Outline
**Provider:** Claude (Anthropic)
**Output:** `StoryOutline` — structured JSON with title, sections, character arcs, moral/theme

```typescript
interface StoryOutline {
  title: string
  logline: string
  sections: OutlineSection[]     // each section: title, summary, characters involved
  characterArcs: CharacterArcNote[]
  theme?: string
  moral?: string
  endingType: "reassuring" | "wonder" | "lesson" | "open"
}
```

---

### Step 04: Validate Outline
**Provider:** OpenAI (GPT-4o)
**Output:** `OutlineValidationReport`

Checks:
- Age-band appropriateness
- Tone match to requested mode
- Canon consistency with world rules
- No character contradictions vs current memory state
- Conflict intensity appropriate for bedtime
- All required prompt elements addressed

```typescript
interface OutlineValidationReport {
  passed: boolean
  issues: ValidationIssue[]   // { type, severity, location, description }
  repairSuggestions?: RepairSuggestion[]
}
```

---

### Step 05: Repair Outline (conditional)
**Trigger:** `outlineValidation.passed === false`
**Provider:** Claude
**Cap:** max 2 repair rounds; if still failing after 2, abort with error

The repair prompt includes the outline + the validation report. Claude repairs only the flagged sections.

---

### Step 06: Generate Story Draft
**Provider:** Claude (Anthropic)
**Input:** Approved outline + context pack
**Output:** `StoryDraft` — array of story pages

```typescript
interface StoryDraft {
  title: string
  pages: StoryPage[]
}

interface StoryPage {
  pageNumber: number
  text: string
  sceneHint?: string    // rough scene description for image extraction
}
```

---

### Step 07: Validate Story
**Provider:** OpenAI (GPT-4o)
**Output:** `StoryValidationReport`

Checks:
- Outline adherence (all sections present, arcs completed)
- Age vocabulary match
- Bedtime safety (no unresolved fear, excessive conflict)
- Canon conflicts vs context pack
- Branch memory contradictions
- Reading time estimate vs target

---

### Step 08: Repair Story (conditional)
**Trigger:** `storyValidation.passed === false`
**Provider:** Claude
**Cap:** max 2 rounds; targets specific failing pages, not full rewrite

Repair prompt includes: failing pages + validation issues + surrounding pages for context.

---

### Step 09: Extract Scene Specs
**Provider:** Gemini (1.5 Flash)
**Input:** Approved story draft
**Output:** `SceneSpec[]`

Gemini reads each page and extracts structured visual moments:
- characters present (with appearance notes)
- setting description
- lighting and mood
- whether this page warrants an illustration

---

### Step 10: Validate Scenes
**Provider:** Internal (Zod schema check)
**Output:** validated `SceneSpec[]` with invalid scenes removed

---

### Step 11: Generate Images
**Provider:** Image provider (DALL·E 3 default)
**Input:** `SceneSpec[]` with approved art style preset
**Output:** `ImageAsset[]`

Each scene spec → Gemini generates an optimized image prompt → image provider generates the image → upload to S3.

Non-critical: if image generation fails, pipeline continues as PARTIAL.

---

### Step 12: Image QA (optional)
**Provider:** Gemini 1.5 Pro (multimodal)
**Input:** Generated images + original scene specs
**Output:** `ImageQAReport[]`

Checks visual consistency (characters recognizable, setting matches), flags severe mismatches for re-generation (max 1 retry per image).

---

### Step 13: Update Memory State
**Provider:** None (internal logic)

After approved story:
- Update `CharacterMemory.evolvingState` for all involved characters
- Append events to `CharacterMemory.eventLog`
- Append new facts to `BranchMemory.facts`
- Update `WorldCanon.lore` if story introduced new world facts (rare)

---

### Step 14: Persist All Outputs
- Write `Story` record with final content
- Write `SceneSpec` records
- Write `ImageAsset` records
- Update `GenerationRun` with final status, log, usage, cost

---

### Step 15: Deliver to Client
- Update job status in Redis
- Client polling or SSE picks up completion
- Frontend reads finished `Story` from API

---

## Error Handling

```typescript
type PipelineError = {
  step: string
  critical: boolean     // if true, pipeline fails; if false, continue to PARTIAL
  message: string
  providerResponse?: string
}
```

Critical steps: 01–08 (request through story validation)
Non-critical steps: 11–12 (images), 13 (memory update, can be retried separately)

---

## Pipeline Entry Point

```typescript
// lib/pipeline/index.ts
export async function runStoryPipeline(
  request: StoryGenerationRequest,
  runId: string,
  userId: string,
): Promise<PipelineContext> {
  const steps = [
    normalizeRequest,
    retrieveContext,
    generateOutline,
    validateAndRepairOutline,   // wraps steps 04-05
    generateStoryDraft,
    validateAndRepairStory,     // wraps steps 07-08
    extractSceneSpecs,
    validateScenes,
    generateImages,
    imageQA,
    updateMemoryState,
    persistAllOutputs,
  ]

  let ctx: PipelineContext = initContext(request, runId, userId)
  for (const step of steps) {
    ctx = await step(ctx)
    await persistRunLog(ctx)    // write log after each step
    if (ctx.status === "failed") break
  }
  return ctx
}
```
