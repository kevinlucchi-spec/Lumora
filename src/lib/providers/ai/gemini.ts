// @ts-nocheck
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"
import { BaseAIAdapter } from "./base-adapter"
import type { AIRequest, RawProviderResponse } from "./types"
import type { AICapability } from "./capabilities"

/**
 * Gemini native response schemas for capabilities that need strict JSON output.
 */
const SCENE_SPEC_SCHEMA = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      order: { type: SchemaType.NUMBER, description: "Scene order starting from 0" },
      description: { type: SchemaType.STRING, description: "What happens in this scene" },
      characters: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Character names in this scene" },
      setting: { type: SchemaType.STRING, description: "Where the scene takes place" },
      mood: { type: SchemaType.STRING, description: "Emotional tone" },
      lighting: { type: SchemaType.STRING, description: "Lighting description" },
      imagePrompt: { type: SchemaType.STRING, description: "Detailed image generation prompt" },
      warrantsIllustration: { type: SchemaType.BOOLEAN, description: "Whether this scene should be illustrated" },
    },
    required: ["order", "description", "characters", "setting", "mood"],
  },
}

const ENRICHED_PROMPTS_SCHEMA = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      order: { type: SchemaType.NUMBER, description: "Scene order number" },
      enrichedPrompt: { type: SchemaType.STRING, description: "Detailed image generation prompt" },
      negativePrompt: { type: SchemaType.STRING, description: "Things to avoid in the image" },
    },
    required: ["order", "enrichedPrompt"],
  },
}

const CAPABILITY_SCHEMAS: Partial<Record<AICapability, unknown>> = {
  "extract:scene-specs": SCENE_SPEC_SCHEMA,
  "generate:image-prompt-pack": ENRICHED_PROMPTS_SCHEMA,
}

export class GeminiAdapter extends BaseAIAdapter {
  readonly name = "gemini"
  readonly supportedCapabilities: AICapability[] = [
    "extract:scene-specs",
    "generate:image-prompt-pack",
  ]

  private client: GoogleGenerativeAI

  constructor(apiKey: string) {
    super()
    this.client = new GoogleGenerativeAI(apiKey)
  }

  protected async execute(request: AIRequest): Promise<RawProviderResponse> {
    const config = request.metadata as { model?: string }
    const model = config?.model ?? "gemini-2.5-flash"

    const nativeSchema = CAPABILITY_SCHEMAS[request.capability]

    const genModel = this.client.getGenerativeModel({
      model,
      generationConfig: {
        responseMimeType: "application/json",
        ...(nativeSchema ? { responseSchema: nativeSchema as never } : {}),
      },
      systemInstruction: request.systemPrompt,
    })

    // Build multipart content if images are provided
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: request.userPrompt },
    ]

    if (request.imageUrls?.length) {
      for (const url of request.imageUrls) {
        const imageData = await fetchImageAsBase64(url)
        if (imageData) {
          parts.push({ inlineData: imageData })
        }
      }
    }

    const result = await genModel.generateContent(parts)
    const response = result.response
    const text = response.text()
    const usage = response.usageMetadata

    return {
      text,
      model,
      usage: {
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
      },
    }
  }

  protected isRetryable(err: unknown): boolean {
    const msg = (err as Error)?.message ?? ""
    return msg.includes("429") || msg.includes("503")
  }
}

async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    if (url.startsWith("data:")) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/)
      if (match) return { mimeType: match[1], data: match[2] }
      return null
    }

    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    const mimeType = response.headers.get("content-type") ?? "image/png"
    return { mimeType, data: buffer.toString("base64") }
  } catch {
    return null
  }
}
