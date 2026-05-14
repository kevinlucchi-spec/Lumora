import { z } from "zod"
import type { AICapability } from "./capabilities"

export interface AIRequest {
  capability: AICapability
  systemPrompt: string
  userPrompt: string
  /** Optional image URLs to include in the user message (for vision-capable models) */
  imageUrls?: string[]
  responseSchema?: z.ZodType<unknown>
  temperature?: number
  maxTokens?: number
  metadata?: Record<string, unknown>
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

export interface RawProviderResponse {
  text: string
  model: string
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

export interface AIProviderAdapter {
  readonly name: string
  readonly supportedCapabilities: AICapability[]
  call<T>(request: AIRequest): Promise<AIResponse<T>>
}

export interface ProviderConfig {
  provider: string
  model: string
}
