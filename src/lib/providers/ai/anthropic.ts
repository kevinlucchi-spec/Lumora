// @ts-nocheck
import Anthropic from "@anthropic-ai/sdk"
import { BaseAIAdapter } from "./base-adapter"
import type { AIRequest, RawProviderResponse } from "./types"
import type { AICapability } from "./capabilities"

export class AnthropicAdapter extends BaseAIAdapter {
  readonly name = "anthropic"
  readonly supportedCapabilities: AICapability[] = [
    "generate:outline",
    "generate:story-draft",
    "generate:repair-plan",
    "generate:image-prompt-repair",
  ]

  private client: Anthropic

  constructor(apiKey: string) {
    super()
    this.client = new Anthropic({ apiKey })
  }

  protected async execute(request: AIRequest): Promise<RawProviderResponse> {
    const config = request.metadata as { model?: string }
    const model = config?.model ?? "claude-sonnet-4-6"

    const systemPrompt = request.responseSchema
      ? `${request.systemPrompt}\n\nYou MUST respond with valid JSON only. No markdown, no explanation — pure JSON.`
      : request.systemPrompt

    const message = await this.client.messages.create({
      model,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: request.userPrompt }],
    })

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("")

    return {
      text,
      model: message.model,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        totalTokens: message.usage.input_tokens + message.usage.output_tokens,
      },
    }
  }

  protected isRetryable(err: unknown): boolean {
    if (err instanceof Anthropic.APIError) {
      return err.status === 429 || err.status >= 500
    }
    return false
  }
}
