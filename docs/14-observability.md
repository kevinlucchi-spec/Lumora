# Observability & Generation Run Logging

## What Gets Logged

Every story generation run produces a `GenerationRun` record that is the complete audit trail for that pipeline execution.

### Full GenerationRun Structure

```typescript
{
  id: string,
  userId: string,
  storyId: string | null,           // set when story is persisted
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL",

  // --- Input ---
  requestPayload: StoryGenerationRequest,
  normalizedRequest: NormalizedRequest,
  contextPack: ContextPack,

  // --- AI Artifacts (versioned) ---
  promptVersions: {
    outlineSchema: "1.0.0",
    storyDraftSchema: "1.0.0",
    // etc.
  },

  // --- Per-Step Logs ---
  providerLog: ProviderLogEntry[],
  // Each entry:
  // {
  //   step: "03-generate-outline",
  //   capability: "generate:outline",
  //   provider: "anthropic",
  //   model: "claude-3-5-sonnet-20241022",
  //   inputTokens: 1240,
  //   outputTokens: 620,
  //   latencyMs: 3200,
  //   success: true,
  //   timestamp: "2025-01-15T10:30:00Z"
  // }

  // --- Validation ---
  validationReports: ValidationReport[],
  // Each: { phase, passed, issues[], repairSuggestions[] }

  // --- Repair Rounds ---
  repairInstructions: RepairRound[],
  // Each: { step, round, instructions, beforeOutput, afterOutput }

  // --- Resource Usage ---
  tokenUsage: {
    anthropic:  { input: number, output: number },
    openai:     { input: number, output: number },
    gemini:     { input: number, output: number },
    xai:        { input: number, output: number },
  },
  costEstimateUsd: number,
  latencyMs: number,             // total pipeline duration

  // --- Errors ---
  errors: PipelineError[],

  // --- Final Output ---
  finalOutput: {
    storyId: string,
    pageCount: number,
    wordCount: number,
    imageCount: number,
    repairRoundsUsed: number,
  },

  createdAt: DateTime,
  completedAt: DateTime,
}
```

---

## Generation Run Inspector (Admin/Debug UI)

Route: `/runs/[runId]`

Accessible only to the run's owner. Shows:

### Header
- Run ID, status badge, start/end time, total duration
- Story link (if completed)

### Timeline
Step-by-step visual timeline:
- Each step shown as row: step name | provider | model | tokens in/out | latency | pass/fail icon
- Color-coded: green = passed, yellow = warning, red = failed
- Expandable row: shows raw input/output JSON for that step

### Validation Reports
- Per-validation phase: outline, story, scene
- Issues listed with severity, location, description
- Repair rounds shown as before/after diffs

### Resource Usage
- Token counts by provider
- Estimated cost breakdown
- Total latency

### Errors
- All pipeline errors with step context and stack trace (dev only)

### Raw Artifacts
- JSON viewer for: normalizedRequest, contextPack, outline, storyDraft, sceneSpecs
- Toggleable raw/parsed view

---

## Cost Estimation

Estimated at run time using known rates:

```typescript
// lib/pipeline/cost-estimator.ts

const RATES = {
  anthropic: {
    "claude-3-5-sonnet-20241022": { input: 3.00, output: 15.00 },  // per 1M tokens
    "claude-3-haiku-20240307":    { input: 0.25, output: 1.25  },
  },
  openai: {
    "gpt-4o":       { input: 2.50, output: 10.00 },
    "gpt-4o-mini":  { input: 0.15, output: 0.60  },
  },
  gemini: {
    "gemini-1.5-flash": { input: 0.075, output: 0.30 },
    "gemini-1.5-pro":   { input: 1.25,  output: 5.00 },
  },
}

export function estimateCost(providerLog: ProviderLogEntry[]): number {
  return providerLog.reduce((total, entry) => {
    const rate = RATES[entry.provider]?.[entry.model]
    if (!rate) return total
    return total
      + (entry.inputTokens  / 1_000_000) * rate.input
      + (entry.outputTokens / 1_000_000) * rate.output
  }, 0)
}
```

---

## Logging Strategy

- **Development:** console logging + Prisma query logs
- **Production:** structured JSON logs via `pino` → stdout → log aggregation (Datadog, Logtail, etc.)
- **Database:** `GenerationRun` is the primary audit record — always written
- **No external logging service required at MVP** — DB-based audit is sufficient

---

## Future Observability (V2)

- OpenTelemetry traces for pipeline steps
- Per-user cost dashboard (monthly spend, per-story cost)
- Provider error rate monitoring
- P50/P95 latency per capability
- Alert on validation failure rate spikes
