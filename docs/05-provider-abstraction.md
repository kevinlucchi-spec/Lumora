# Provider Abstraction Layer

## Design Goals

- No raw provider SDK calls outside of adapter files
- Capabilities are the interface, providers are the implementation
- Swapping a provider for a capability requires changing one line (the registry)
- Every call normalizes: request → response → usage metadata
- Retries, timeouts, and error classification live in the adapter base class

---

## Capability Registry

Capabilities are named strings that map to a provider + model at runtime.

```typescript
// lib/providers/ai/capabilities.ts

export type AICapability =
  | "generate:outline"
  | "generate:story-draft"
  | "generate:repair-plan"
  | "validate:outline"
  | "validate:story"
  | "validate:continuity"
  | "extract:scene-specs"
  | "generate:image-prompt-pack"
  | "qa:image"
  | "rank:candidates"
  | "generate:story-variant"

export const CAPABILITY_REGISTRY: Record<AICapability, ProviderConfig> = {
  "generate:outline":         { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
  "generate:story-draft":     { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
  "generate:repair-plan":     { provider: "anthropic", model: "claude-3-haiku-20240307" },
  "validate:outline":         { provider: "openai",    model: "gpt-4o" },
  "validate:story":           { provider: "openai",    model: "gpt-4o" },
  "validate:continuity":      { provider: "openai",    model: "gpt-4o" },
  "extract:scene-specs":      { provider: "gemini",    model: "gemini-1.5-flash" },
  "generate:image-prompt-pack":{ provider: "gemini",   model: "gemini-1.5-flash" },
  "qa:image":                 { provider: "gemini",    model: "gemini-1.5-pro" },
  "rank:candidates":          { provider: "xai",       model: "grok-2-1212" },
  "generate:story-variant":   { provider: "xai",       model: "grok-2-1212" },
}
```

---

## AI Provider Interface

```typescript
// lib/providers/ai/types.ts

export interface AIRequest {
  capability: AICapability
  systemPrompt: string
  userPrompt: string
  responseSchema?: z.ZodType<unknown>   // if set, provider enforces structured output
  temperature?: number
  maxTokens?: number
  metadata?: Record<string, unknown>    // passed through to log
}

export interface AIResponse<T = unknown> {
  output: T
  rawText: string
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  latencyMs: number
  provider: string
  model: string
  capability: AICapability
}

export interface AIProviderAdapter {
  readonly name: string
  readonly supportedCapabilities: AICapability[]
  call<T>(request: AIRequest): Promise<AIResponse<T>>
}
```

---

## Base Adapter

```typescript
// lib/providers/ai/base-adapter.ts

export abstract class BaseAIAdapter implements AIProviderAdapter {
  abstract readonly name: string
  abstract readonly supportedCapabilities: AICapability[]

  protected readonly maxRetries = 2
  protected readonly timeoutMs = 30_000

  async call<T>(request: AIRequest): Promise<AIResponse<T>> {
    let lastError: Error | undefined
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const start = Date.now()
        const raw = await this.execute(request)
        const parsed = request.responseSchema
          ? request.responseSchema.parse(JSON.parse(raw.text))
          : raw.text
        return {
          output: parsed as T,
          rawText: raw.text,
          usage: raw.usage,
          latencyMs: Date.now() - start,
          provider: this.name,
          model: raw.model,
          capability: request.capability,
        }
      } catch (err) {
        lastError = err as Error
        if (this.isRetryable(err) && attempt < this.maxRetries) {
          await sleep(exponentialBackoff(attempt))
          continue
        }
        throw err
      }
    }
    throw lastError
  }

  protected abstract execute(request: AIRequest): Promise<RawProviderResponse>
  protected abstract isRetryable(err: unknown): boolean
}
```

---

## Provider Adapters

### AnthropicAdapter
- Uses `@anthropic-ai/sdk`
- Wraps `messages.create()` with system/user structure
- Structured output via tool_use or `</response>` XML tag pattern
- Maps `usage.input_tokens`, `usage.output_tokens`

### OpenAIAdapter
- Uses `openai` SDK
- `response_format: { type: "json_schema" }` for structured output
- Maps `usage.prompt_tokens`, `usage.completion_tokens`

### GeminiAdapter
- Uses `@google/generative-ai` SDK
- `generationConfig.responseMimeType = "application/json"` for structured output
- Handles multimodal requests (image + text) for image QA capability

### xAIAdapter
- Uses OpenAI-compatible API with xAI base URL
- Same interface as OpenAIAdapter, different endpoint + key

---

## AI Provider Router

```typescript
// lib/providers/ai/router.ts

export class AIProviderRouter {
  private adapters: Map<string, AIProviderAdapter>

  constructor(adapters: AIProviderAdapter[]) {
    this.adapters = new Map(adapters.map(a => [a.name, a]))
  }

  async call<T>(request: AIRequest): Promise<AIResponse<T>> {
    const config = CAPABILITY_REGISTRY[request.capability]
    const adapter = this.adapters.get(config.provider)
    if (!adapter) throw new Error(`No adapter for provider: ${config.provider}`)
    return adapter.call<T>({ ...request, metadata: { ...request.metadata, model: config.model } })
  }
}
```

---

## Image Provider Interface

```typescript
// lib/providers/image/types.ts

export interface ImageRequest {
  prompt: string
  negativePrompt?: string
  style?: string
  width?: number
  height?: number
  artStylePreset?: ArtStylePresetSpec
  metadata?: Record<string, unknown>
}

export interface ImageResponse {
  storageKey: string
  url: string
  provider: string
  model: string
  metadata: Record<string, unknown>
}

export interface ImageProviderAdapter {
  readonly name: string
  generate(request: ImageRequest): Promise<ImageResponse>
}
```

Image providers: `DalleAdapter`, `StabilityAdapter`. Same registry pattern.

---

## Usage in Pipeline

```typescript
// Inside a pipeline step
const response = await router.call<StoryOutline>({
  capability: "generate:outline",
  systemPrompt: buildOutlineSystemPrompt(contextPack),
  userPrompt: buildOutlineUserPrompt(normalizedRequest),
  responseSchema: StoryOutlineSchema,
  temperature: 0.8,
})
// response.output is typed as StoryOutline
// response.usage, response.latencyMs logged to GenerationRun
```
