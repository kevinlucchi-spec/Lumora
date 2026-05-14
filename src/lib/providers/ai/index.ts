// @ts-nocheck
import { AnthropicAdapter } from "./anthropic"
import { OpenAIAdapter } from "./openai"
import { GeminiAdapter } from "./gemini"
import { XAIAdapter } from "./xai"
import { AIProviderRouter } from "./router"
import type { AIProviderAdapter } from "./types"

let _router: AIProviderRouter | null = null

export function getAIRouter(): AIProviderRouter {
  if (_router) return _router

  const adapters: AIProviderAdapter[] = [
    new AnthropicAdapter(process.env.ANTHROPIC_API_KEY!),
    new OpenAIAdapter(process.env.OPENAI_API_KEY!),
    new GeminiAdapter(process.env.GOOGLE_AI_API_KEY!),
  ]

  if (process.env.XAI_API_KEY) {
    adapters.push(new XAIAdapter(process.env.XAI_API_KEY))
  }

  _router = new AIProviderRouter(adapters)
  return _router
}

export { AIProviderRouter } from "./router"
export type { AIRequest, AIResponse, AIProviderAdapter } from "./types"
export type { AICapability } from "./capabilities"
