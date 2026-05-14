// @ts-nocheck
import OpenAI, { toFile } from "openai"
import type { ImageRequest, ImageResponse, ImageProviderAdapter } from "./types"

export class DalleAdapter implements ImageProviderAdapter {
  readonly name = "dalle"
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async generate(request: ImageRequest): Promise<ImageResponse> {
    const style = request.artStylePreset?.styleKeywords?.join(", ")
    const fullPrompt = style ? `${style} style. ${request.prompt}` : request.prompt

    // If reference images provided, use edit mode to maintain character consistency
    if (request.referenceImageUrls?.length) {
      return this.generateWithReferences(fullPrompt, request)
    }

    const response = await this.client.images.generate({
      model: "gpt-image-1",
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      quality: "medium",
    })

    const imageData = response.data?.[0]
    const imageUrl = imageData?.url ?? (imageData?.b64_json ? `data:image/png;base64,${imageData.b64_json}` : "")
    const storageKey = `images/${Date.now()}-gpt-image.png`

    return {
      storageKey,
      url: imageUrl,
      provider: "dalle",
      model: "gpt-image-1",
      metadata: {
        revisedPrompt: imageData?.revised_prompt,
        originalPrompt: fullPrompt,
      },
    }
  }

  private async generateWithReferences(prompt: string, request: ImageRequest): Promise<ImageResponse> {
    // Fetch reference images as buffers for the edit API
    const imageFiles: Array<Awaited<ReturnType<typeof toFile>>> = []
    for (const url of request.referenceImageUrls ?? []) {
      try {
        const buf = await fetchImageBuffer(url)
        if (buf) {
          imageFiles.push(await toFile(buf, `ref-${imageFiles.length}.png`, { type: "image/png" }))
        }
      } catch {
        // Skip failed fetches
      }
    }

    if (imageFiles.length === 0) {
      // No reference images fetched — fall back to normal generation
      return this.generate({ ...request, referenceImageUrls: undefined })
    }

    // Use gpt-image-1 edit mode with reference images
    const response = await this.client.images.edit({
      model: "gpt-image-1",
      image: imageFiles,
      prompt: `Using the attached character reference image(s) as the EXACT character design, generate: ${prompt}. The character must look IDENTICAL to the reference — same proportions, colors, features, and art style.`,
      n: 1,
      size: "1024x1024",
    })

    const imageData = response.data?.[0]
    const imageUrl = imageData?.url ?? (imageData?.b64_json ? `data:image/png;base64,${imageData.b64_json}` : "")
    const storageKey = `images/${Date.now()}-gpt-image-ref.png`

    return {
      storageKey,
      url: imageUrl,
      provider: "dalle",
      model: "gpt-image-1",
      metadata: {
        revisedPrompt: imageData?.revised_prompt,
        originalPrompt: prompt,
        usedReferenceImages: true,
      },
    }
  }
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith("data:")) {
      const match = url.match(/^data:[^;]+;base64,(.+)$/)
      if (match) return Buffer.from(match[1], "base64")
      return null
    }
    const response = await fetch(url)
    if (!response.ok) return null
    return Buffer.from(await response.arrayBuffer())
  } catch {
    return null
  }
}
