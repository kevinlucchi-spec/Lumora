// @ts-nocheck
import { getAIRouter } from "@/lib/providers/ai"
import { z } from "zod"
import { visualProfileToPromptFragment, VisualProfileSchema } from "@/lib/schemas/visual-profile"
import { prisma } from "@/lib/prisma"
import { getSignedReadUrl } from "@/lib/storage/r2"
import type { PipelineContext } from "../types"

const EnrichedPromptsSchema = z.array(
  z.object({
    order: z.number(),
    enrichedPrompt: z.string(),
    negativePrompt: z.string().optional(),
  }),
)

/**
 * Step 10b: Gemini enriches image prompts with character visual profiles,
 * art style consistency, and scene-specific visual direction.
 */
export async function enrichImagePrompts(ctx: PipelineContext): Promise<PipelineContext> {
  const start = Date.now()
  if (!ctx.sceneSpecs || ctx.sceneSpecs.length === 0 || !ctx.request.generateImages) {
    ctx.log.push({ step: "enrich-image-prompts", status: "skipped" })
    return ctx
  }

  try {
    return await doEnrichImagePrompts(ctx, start)
  } catch (err) {
    // Gracefully degrade — use raw scene prompts + character refs as fallback
    console.error("[enrich-image-prompts] Gemini enrichment failed, using fallback:", (err as Error).message)
    ctx._enrichedPrompts = buildFallbackPrompts(ctx)
    ctx.log.push({ step: "enrich-image-prompts", status: "completed", durationMs: Date.now() - start })
    ctx.errors.push({ step: "enrich-image-prompts", critical: false, message: `Enrichment failed, using fallback: ${(err as Error).message}` })
    return ctx
  }
}

function buildFallbackPrompts(ctx: PipelineContext): z.infer<typeof EnrichedPromptsSchema> {
  if (!ctx.sceneSpecs) return []

  const characterVisualRefs: string[] = []
  if (ctx.normalizedRequest?.resolvedCharacters) {
    for (const char of ctx.normalizedRequest.resolvedCharacters) {
      const rawProfile = (char as unknown as { visualProfile?: unknown }).visualProfile
      if (rawProfile) {
        const parsed = VisualProfileSchema.safeParse(rawProfile)
        if (parsed.success) {
          characterVisualRefs.push(visualProfileToPromptFragment(char.name, parsed.data))
        }
      }
    }
  }

  const artStyle = ctx.normalizedRequest?.resolvedArtStyle
    ? `${ctx.normalizedRequest.resolvedArtStyle.styleKeywords.join(", ")}, ${ctx.normalizedRequest.resolvedArtStyle.medium ?? "digital illustration"}`
    : "warm, soft digital illustration, children's bedtime book style"

  return ctx.sceneSpecs.map((scene) => ({
    order: scene.order,
    enrichedPrompt: `${artStyle}. ${scene.description}. Setting: ${scene.setting}. Mood: ${scene.mood}. ${scene.lighting ? `Lighting: ${scene.lighting}.` : ""} ${characterVisualRefs.length > 0 ? `Characters: ${characterVisualRefs.join(". ")}` : ""}`.trim(),
    negativePrompt: "scary, dark, violent, realistic photo, text, watermark, signature, extra fingers, distorted face",
  }))
}

async function doEnrichImagePrompts(ctx: PipelineContext, start: number): Promise<PipelineContext> {

  // Build character visual reference strings
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

      // Fetch portrait image URL if the character has one
      try {
        const template = await prisma.characterTemplate.findUnique({
          where: { id: char.templateId },
          select: { portraitAssetId: true },
        })
        if (template?.portraitAssetId) {
          const portrait = await prisma.imageAsset.findUnique({
            where: { id: template.portraitAssetId },
            select: { url: true, storageKey: true },
          })
          if (portrait) {
            const url = portrait.url.startsWith("http") || portrait.url.startsWith("data:")
              ? portrait.url
              : await getSignedReadUrl(portrait.url, 300).catch(() => null)
            if (url) portraitImageUrls.push(url)
          }
        }
      } catch {
        // Portrait fetch failed — continue without it
      }
    }
  }

  const hasPortraits = portraitImageUrls.length > 0
  const artStyleContext = ctx.normalizedRequest?.resolvedArtStyle
    ? `Art style: ${ctx.normalizedRequest.resolvedArtStyle.styleKeywords.join(", ")}. Medium: ${ctx.normalizedRequest.resolvedArtStyle.medium ?? "digital illustration"}.`
    : "Art style: warm, soft digital illustration suitable for a children's bedtime book."

  const router = getAIRouter()
  const response = await router.call({
    capability: "generate:image-prompt-pack",
    systemPrompt: `You are a visual director for children's picture books. Your job is to take scene specifications and produce rich, detailed image generation prompts that will create consistent, beautiful illustrations.

CRITICAL RULES:
${hasPortraits ? `- CHARACTER REFERENCE IMAGES ARE ATTACHED. Study them carefully. Your prompts MUST describe each character EXACTLY as they appear in their reference portrait — same proportions, same face shape, same fur/hair color and texture, same eye color and size, same style, same AGE. Do NOT deviate from the reference images.
- Describe the character's specific visual traits in granular detail (e.g. "a small silver-furred fox kit with oversized pointed ears, large round bright blue eyes, a soft rounded snout, and a star-shaped white marking on the forehead") so the image generator reproduces the exact same character design.` : `- Every character mentioned MUST match their visual profile exactly. Use the exact colors, features, and clothing described.`}
- For LIBRARY CHARACTERS (those with visual profiles/portraits attached): their age is defined by their profile, NOT the audience. If a character's profile says they are 7 years old, draw them as 7 — even if the story is for tweens or preteens. NEVER age up or age down a library character to match the audience.
- For STORY-GENERATED supporting characters (those without portraits): their age can naturally fit the story context. They do NOT need to match the main character's age.
- Maintain consistent art style across all scenes.
- Prompts should be detailed (100-200 words) with specific visual direction.
- Include lighting, composition, mood, and camera angle.
- Always include negative prompts to avoid common issues (extra fingers, distorted faces, text in image).

Return a JSON array with one object per scene.`,
    userPrompt: `${artStyleContext}

${hasPortraits ? "CHARACTER REFERENCE PORTRAITS ARE ATTACHED BELOW. Study each portrait image carefully and describe the characters EXACTLY as shown — same body shape, face, colors, proportions, and style." : ""}

CHARACTER VISUAL REFERENCES (use these EXACTLY for consistency):
${characterVisualRefs.length > 0 ? characterVisualRefs.join("\n\n") : "No specific character profiles available — use the scene descriptions."}

SCENE SPECIFICATIONS:
${JSON.stringify(ctx.sceneSpecs, null, 2)}

For each scene, produce an enriched image prompt and a negative prompt. Return JSON array:
[{ "order": <number>, "enrichedPrompt": "<detailed prompt>", "negativePrompt": "<things to avoid>" }]`,
    imageUrls: hasPortraits ? portraitImageUrls : undefined,
    responseSchema: EnrichedPromptsSchema,
    temperature: 0.6,
  })

  // Merge enriched prompts back into scene specs
  const enriched = response.output as z.infer<typeof EnrichedPromptsSchema>
  for (const ep of enriched) {
    const scene = ctx.sceneSpecs?.find((s) => s.order === ep.order)
    if (scene) {
      scene.imagePrompt = ep.enrichedPrompt
    }
  }

  // Store negative prompts in pipeline context for image generation step
  ctx._enrichedPrompts = enriched

  ctx.log.push({
    step: "enrich-image-prompts",
    status: "completed",
    durationMs: Date.now() - start,
    provider: response.provider,
    model: response.model,
    tokenUsage: response.usage,
  })

  return ctx
}
