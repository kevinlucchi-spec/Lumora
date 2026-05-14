import type { StoryGenerationRequest } from "@/lib/schemas/request"
import type { ContextPack } from "@/lib/memory/types"
import type { StoryOutline } from "@/lib/schemas/outline"
import type { StoryContent } from "@/lib/schemas/story"
import type { SceneSpec } from "@/lib/schemas/scene"
import type { PipelineLogEntry } from "@/lib/schemas/generation-run"

export interface ResolvedWorld {
  name: string
  rules: Record<string, unknown>
  toneGuide: Record<string, unknown>
}

export interface NormalizedRequest extends StoryGenerationRequest {
  resolvedCharacters: ResolvedCharacter[]
  resolvedArtStyle?: ArtStylePresetSpec
  resolvedWorld?: ResolvedWorld
  /** Resolved story prompt — from custom text, library seed, or placeholder for auto */
  resolvedPrompt: string
  /** Custom world description (when worldMode=custom) */
  resolvedCustomWorld?: string
  /** Custom art style description (when artStyleMode=custom) */
  resolvedCustomArtStyle?: string
  targetWordCount: number
  toneSpec: ToneSpec
}

export interface ResolvedCharacter {
  instanceId: string
  templateId: string
  name: string
  essence: Record<string, unknown>
  visualProfile?: Record<string, unknown>
  currentState: Record<string, unknown>
}

export interface ArtStylePresetSpec {
  styleKeywords: string[]
  medium?: string
  colorPalette?: string
  negativeTerms?: string[]
}

export interface ToneSpec {
  mode: string
  ageBand: string
  intensity: "very_low" | "low" | "medium"
  vocabulary: "simple" | "moderate" | "advanced"
  targetWordCount: number
}

export interface StoryDraft {
  title: string
  pages: Array<{
    pageNumber: number
    text: string
    sceneHint?: string
  }>
}

export interface PipelineError {
  step: string
  critical: boolean
  message: string
  providerResponse?: string
}

export interface EnrichedPrompt {
  order: number
  enrichedPrompt: string
  negativePrompt?: string
}

export interface PipelineContext {
  runId: string
  userId: string
  request: StoryGenerationRequest
  normalizedRequest?: NormalizedRequest
  contextPack?: ContextPack
  outline?: StoryOutline
  storyDraft?: StoryDraft
  sceneSpecs?: SceneSpec[]
  imageAssets?: ImageAssetRef[]
  finalStory?: { title: string; content: StoryContent }
  log: PipelineLogEntry[]
  errors: PipelineError[]
  status: "running" | "completed" | "failed" | "partial"
  /** Enriched image prompts from Gemini (step 10b), used in image generation */
  _enrichedPrompts?: EnrichedPrompt[]
}

export interface ImageAssetRef {
  sceneOrder: number
  storageKey: string
  url: string
  prompt?: string
  negativePrompt?: string
  provider: string
  model: string
}

export type PipelineStep = (ctx: PipelineContext) => Promise<PipelineContext>
