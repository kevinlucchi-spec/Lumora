// @ts-nocheck
import { getAIRouter } from "@/lib/providers/ai"
import { IMAGE_CAP_MAP } from "./01-normalize-request"
import { visualProfileToPromptFragment, VisualProfileSchema } from "@/lib/schemas/visual-profile"
import { prisma } from "@/lib/prisma"
import { getSignedReadUrl } from "@/lib/storage/r2"
import { z } from "zod"
import type { PipelineContext } from "../types"

const EnrichedSceneSchema = z.array(
  z.object({
    order: z.number(),
    description: z.string(),
    characters: z.array(z.string()),
    setting: z.string(),
    mood: z.string(),
    lighting: z.string().optional(),
    warrantsIllustration: z.boolean(),
    enrichedPrompt: z.string(),
    negativePrompt: z.string().optional(),
  }),
)

/**
 * Combined step: extract scene specs AND enrich image prompts in a single Gemini call.
 * Saves one full API round-trip (~5-7s).
 */
export async function extractAndEnrichScenes(ctx: PipelineContext): Promise<PipelineContext> {
  const start = Date.now()
  if (!ctx.storyDraft) throw new Error("No story draft for scene extraction")
  if (!ctx.request.generateImages) {
    ctx.log.push({ step: "extract-and-enrich-scenes", status: "skipped" })
    return ctx
  }

  const length = ctx.normalizedRequest?.length ?? ctx.request.length
  const maxImages = Math.min(IMAGE_CAP_MAP[length] ?? 4, 3)

  // Build character visual references
  const characterVisualRefs: string[] = []
  const portraitImageUrls: string[] = []

  if (ctx.normalizedRequest?.resolvedCharacters) {
    for (const char of ctx.normalizedRequest.resolvedCharacters) {
      const rawProfile = (char as unknown as { visualProfile?: unknown }).visualProfile
      if (rawProfile) {
        const parsed = VisualProfileSchema.safeParse(rawProfile)
        if (parsed.success) {
          characterVisualRefs.push(visualProfileToPromptFragment(char.name, parsed.data))
        }
      }

      // Fetch portrait URL
      try {
        const template = await prisma.characterTemplate.findUnique({
          where: { id: char.templateId },
          select: { portraitAssetId: true },
        })
        if (template?.portraitAssetId) {
          const portrait = await prisma.imageAsset.findUnique({
            where: { id: template.portraitAssetId },
            select: { url: true },
          })
          if (portrait) {
            const url = portrait.url.startsWith("http") || portrait.url.startsWith("data:")
              ? portrait.url
              : await getSignedReadUrl(portrait.url, 300).catch(() => null)
            if (url) portraitImageUrls.push(url)
          }
        }
      } catch { /* skip */ }
    }
  }

  const hasPortraits = portraitImageUrls.length > 0
  const artStyleContext = ctx.normalizedRequest?.resolvedArtStyle
    ? `Art style: ${ctx.normalizedRequest.resolvedArtStyle.styleKeywords.join(", ")}. Medium: ${ctx.normalizedRequest.resolvedArtStyle.medium ?? "digital illustration"}.`
    : "Art style: warm, soft digital illustration suitable for a children's bedtime book."

  try {
    const router = getAIRouter()
    const response = await router.call({
      capability: "extract:scene-specs",
      systemPrompt: `You are a visual director for children's picture books. Your job is to:
1. Extract key visual moments from the story as scene specifications
2. Write rich, detailed image generation prompts for each scene

Return ONLY a valid JSON array with this EXACT structure for each scene:
[
  {
    "order": 0,
    "description": "What is happening in this scene",
    "characters": ["Character Name 1"],
    "setting": "Where the scene takes place",
    "mood": "The emotional tone",
    "lighting": "Lighting description",
    "warrantsIllustration": true,
    "enrichedPrompt": "A detailed 100-200 word image generation prompt with specific visual direction, composition, lighting, art style, and character details",
    "negativePrompt": "Things to avoid: scary, dark, violent, realistic photo, text, watermark, extra fingers, distorted face"
  }
]

SCENE SELECTION RULES:
- Return EXACTLY ${maxImages} scenes. Every story has illustratable moments.
- Spread evenly: opening, middle, ending.
- Select moments with visual interest: emotional peaks, setting reveals, character interactions.
- ALL scenes MUST have "warrantsIllustration": true

IMAGE PROMPT RULES:
${hasPortraits ? `- CHARACTER REFERENCE IMAGES ARE ATTACHED. Describe each character EXACTLY as they appear — same proportions, face, colors, age, style.` : `- Match character visual profiles exactly.`}
- For LIBRARY CHARACTERS: their age is defined by their profile, NOT the audience age band.
- ${artStyleContext}
- Include lighting, composition, mood, and camera angle in each prompt.
- Prompts should be 100-200 words with specific visual direction.`,
      userPrompt: `${hasPortraits ? "CHARACTER REFERENCE PORTRAITS ARE ATTACHED. Study them carefully.\n\n" : ""}${characterVisualRefs.length > 0 ? `CHARACTER VISUAL REFERENCES:\n${characterVisualRefs.join("\n\n")}\n\n` : ""}STORY TO ILLUSTRATE:\n${JSON.stringify(ctx.storyDraft.pages)}`,
      imageUrls: hasPortraits ? portraitImageUrls : undefined,
      responseSchema: EnrichedSceneSchema,
      temperature: 0.5,
    })

    let scenes = (response.output ?? []) as z.infer<typeof EnrichedSceneSchema>

    // Hard-enforce the image cap
    if (scenes.length > maxImages) scenes = scenes.slice(0, maxImages)

    // Ensure at least one scene
    if (scenes.length === 0 && ctx.storyDraft.pages.length > 0) {
      scenes = buildFallbackScenes(ctx, maxImages, artStyleContext, characterVisualRefs)
    }

    // Split into sceneSpecs and enrichedPrompts for downstream steps
    ctx.sceneSpecs = scenes.map((s) => ({
      order: s.order,
      description: s.description,
      characters: s.characters,
      setting: s.setting,
      mood: s.mood,
      lighting: s.lighting,
      imagePrompt: s.enrichedPrompt,
      warrantsIllustration: s.warrantsIllustration,
    }))

    ctx._enrichedPrompts = scenes.map((s) => ({
      order: s.order,
      enrichedPrompt: s.enrichedPrompt,
      negativePrompt: s.negativePrompt,
    }))

    ctx.log.push({
      step: "extract-and-enrich-scenes",
      status: "completed",
      durationMs: Date.now() - start,
      provider: response.provider,
      model: response.model,
    })
  } catch (err) {
    console.error("[extract-and-enrich-scenes] Failed, using fallback:", (err as Error).message)
    const fallback = buildFallbackScenes(ctx, maxImages, artStyleContext, characterVisualRefs)
    ctx.sceneSpecs = fallback.map((s) => ({
      order: s.order,
      description: s.description,
      characters: s.characters,
      setting: s.setting,
      mood: s.mood,
      lighting: s.lighting,
      imagePrompt: s.enrichedPrompt,
      warrantsIllustration: true,
    }))
    ctx._enrichedPrompts = fallback.map((s) => ({
      order: s.order,
      enrichedPrompt: s.enrichedPrompt,
      negativePrompt: s.negativePrompt,
    }))
    ctx.log.push({ step: "extract-and-enrich-scenes", status: "completed", durationMs: Date.now() - start })
    ctx.errors.push({ step: "extract-and-enrich-scenes", critical: false, message: (err as Error).message })
  }

  return ctx
}

function buildFallbackScenes(ctx: PipelineContext, maxImages: number, artStyle: string, charRefs: string[]) {
  const pages = ctx.storyDraft!.pages
  const peakIdx = Math.floor(pages.length / 2)
  const indices = pages.length === 1
    ? [0]
    : pages.length === 2
    ? [0, 1]
    : [0, peakIdx, pages.length - 1]

  return indices.slice(0, maxImages).map((idx, i) => ({
    order: i,
    description: pages[idx].text.slice(0, 200),
    characters: [] as string[],
    setting: "Story scene",
    mood: "warm",
    lighting: "soft warm lighting",
    warrantsIllustration: true,
    enrichedPrompt: `${artStyle} ${pages[idx].text.slice(0, 300)}. Soft, warm colors, gentle lighting, cozy atmosphere. ${charRefs.length > 0 ? charRefs.join(". ") : ""}`.trim(),
    negativePrompt: "scary, dark, violent, realistic photo, text, watermark, signature, extra fingers, distorted face",
  }))
}
