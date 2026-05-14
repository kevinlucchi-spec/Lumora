// @ts-nocheck
import type { ImageRequest, ImageResponse, ImageProviderAdapter } from "./types"

/**
 * Image generation model configuration.
 * Centralized — update here when models change.
 */
const IMAGEN_MODEL = "imagen-4.0-fast-generate-001"
const IMAGEN_API_VERSION = "v1beta"

/**
 * Google Imagen adapter via Gemini REST API.
 * Uses the predict method with instances/parameters format.
 *
 * NOTE: Requires a paid Google AI plan. Free tier does not support image generation.
 * If this fails with 400/403, the provider factory will fall back to DALL-E.
 */
export class ImagenAdapter implements ImageProviderAdapter {
  readonly name = "imagen"
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generate(request: ImageRequest): Promise<ImageResponse> {
    const style = request.artStylePreset?.styleKeywords?.join(", ")
    const fullPrompt = style ? `${style} style. ${request.prompt}` : request.prompt

    const url = `https://generativelanguage.googleapis.com/${IMAGEN_API_VERSION}/models/${IMAGEN_MODEL}:predict?key=${this.apiKey}`

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: fullPrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1",
          personGeneration: "ALLOW_ADULT",
        },
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error(`[imagen] API error (${response.status}):`, errBody)
      throw new ImageGenerationError(
        `Image generation failed (${response.status})`,
        errBody,
      )
    }

    const data = await response.json()
    const prediction = data.predictions?.[0]
    const imageBytes = prediction?.bytesBase64Encoded

    if (!imageBytes) {
      console.error("[imagen] No image data in response:", JSON.stringify(data).slice(0, 500))
      throw new ImageGenerationError(
        "Image generation returned no image data",
        JSON.stringify(data),
      )
    }

    const mimeType = prediction.mimeType ?? "image/png"
    const dataUrl = `data:${mimeType};base64,${imageBytes}`
    const storageKey = `images/${Date.now()}-imagen.png`

    return {
      storageKey,
      url: dataUrl,
      provider: "imagen",
      model: IMAGEN_MODEL,
      metadata: {
        originalPrompt: fullPrompt,
        mimeType,
      },
    }
  }
}

/**
 * Custom error that separates user-facing message from provider debug detail.
 */
export class ImageGenerationError extends Error {
  public readonly providerDetail: string

  constructor(userMessage: string, providerDetail: string) {
    super(userMessage)
    this.name = "ImageGenerationError"
    this.providerDetail = providerDetail
  }
}
