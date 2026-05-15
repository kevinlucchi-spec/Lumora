// @ts-nocheck
import type { AIRequest, AIResponse, AIProviderAdapter, RawProviderResponse } from "./types"
import type { AICapability } from "./capabilities"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function exponentialBackoff(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10_000)
}

/**
 * Strip markdown code fences and surrounding text from AI responses.
 * Models often wrap JSON in ```json ... ``` even when told not to.
 */
function extractJson(text: string): string {
  const trimmed = text.trim()
  // Try to extract from code fences first
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch) return fenceMatch[1].trim()
  // If it starts with { or [, assume it's already raw JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed
  // Last resort: find the first { or [ and last } or ]
  const firstBrace = trimmed.indexOf("{")
  const firstBracket = trimmed.indexOf("[")
  const start = firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket) ? firstBrace : firstBracket
  if (start >= 0) {
    const closer = trimmed[start] === "{" ? "}" : "]"
    const end = trimmed.lastIndexOf(closer)
    if (end > start) return trimmed.slice(start, end + 1)
  }
  return trimmed
}

export abstract class BaseAIAdapter implements AIProviderAdapter {
  abstract readonly name: string
  abstract readonly supportedCapabilities: AICapability[]

  protected readonly maxRetries = 1
  protected readonly timeoutMs = 25_000

  async call<T>(request: AIRequest): Promise<AIResponse<T>> {
    let lastError: Error | undefined
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const start = Date.now()
        const raw = await Promise.race([
          this.execute(request),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`AI call timed out after ${this.timeoutMs}ms (${this.name}, ${request.capability})`)), this.timeoutMs)
          ),
        ])
        let parsed: unknown
        if (request.responseSchema) {
          const jsonStr = extractJson(raw.text)
          try {
            parsed = request.responseSchema.parse(JSON.parse(jsonStr))
          } catch (zodErr) {
            // Log the raw response for debugging schema mismatches
            console.error(`[ai-adapter] Schema validation failed for ${request.capability}. Raw text (first 500 chars):`, raw.text.slice(0, 500))
            console.error(`[ai-adapter] Extracted JSON (first 500 chars):`, jsonStr.slice(0, 500))
            throw zodErr
          }
        } else {
          parsed = raw.text
        }
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
