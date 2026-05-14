import OpenAI from "openai"
import { BaseAIAdapter } from "./base-adapter"
import type { AIRequest, RawProviderResponse } from "./types"
import type { AICapability } from "./capabilities"

export class XAIAdapter extends BaseAIAdapter {
  readonly name = "xai"
  readonly supportedCapabilities: AICapability[] = [
    "rank:candidates",
    "generate:story-variant",
    "qa:image-character",
  ]

  private client: OpenAI

  constructor(apiKey: string) {
    super()
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.x.ai/v1",
    })
  }

  protected async execute(request: AIRequest): Promise<RawProviderResponse> {
    const config = request.metadata as { model?: string }
    const model = config?.model ?? "grok-2-1212"

    // Build user message content — text + optional images for vision
    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: "text", text: request.userPrompt },
    ]

    if (request.imageUrls?.length) {
      for (const url of request.imageUrls) {
        userContent.push({
          type: "image_url",
          image_url: { url, detail: "low" },
        })
      }
    }

    const completion = await this.client.chat.completions.create({
      model,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2048,
      response_format: request.responseSchema ? { type: "json_object" } : undefined,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: userContent },
      ],
    })

    const text = completion.choices[0]?.message?.content ?? ""
    const usage = completion.usage

    return {
      text,
      model: completion.model,
      usage: {
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
      },
    }
  }

  protected isRetryable(err: unknown): boolean {
    if (err instanceof OpenAI.APIError) {
      return err.status === 429 || err.status >= 500
    }
    return false
  }
}
