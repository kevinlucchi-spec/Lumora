// @ts-nocheck
import { CAPABILITY_REGISTRY, type AICapability } from "./capabilities"
import type { AIRequest, AIResponse, AIProviderAdapter } from "./types"

export class AIProviderRouter {
  private adapters: Map<string, AIProviderAdapter>

  constructor(adapters: AIProviderAdapter[]) {
    this.adapters = new Map(adapters.map((a) => [a.name, a]))
  }

  async call<T>(request: AIRequest): Promise<AIResponse<T>> {
    const config = CAPABILITY_REGISTRY[request.capability]
    if (!config) throw new Error(`Unknown capability: ${request.capability}`)
    const adapter = this.adapters.get(config.provider)
    if (!adapter) throw new Error(`No adapter registered for provider: ${config.provider}`)
    return adapter.call<T>({
      ...request,
      metadata: { ...request.metadata, model: config.model },
    })
  }
}
