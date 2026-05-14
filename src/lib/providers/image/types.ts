export interface ArtStylePresetSpec {
  styleKeywords: string[]
  medium?: string
  colorPalette?: string
  negativeTerms?: string[]
}

export interface ImageRequest {
  prompt: string
  negativePrompt?: string
  style?: string
  width?: number
  height?: number
  artStylePreset?: ArtStylePresetSpec
  /** Reference images (e.g. character portraits) for style/character consistency */
  referenceImageUrls?: string[]
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
