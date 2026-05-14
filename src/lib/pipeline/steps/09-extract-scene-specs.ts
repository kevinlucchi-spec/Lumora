import { getAIRouter } from "@/lib/providers/ai"
import { SceneSpecArraySchema, type SceneSpec } from "@/lib/schemas/scene"
import { IMAGE_CAP_MAP } from "./01-normalize-request"
import type { PipelineContext } from "../types"

export async function extractSceneSpecs(ctx: PipelineContext): Promise<PipelineContext> {
  const start = Date.now()
  if (!ctx.storyDraft) throw new Error("No story draft for scene extraction")
  if (!ctx.request.generateImages) {
    ctx.log.push({ step: "extract-scene-specs", status: "skipped" })
    return ctx
  }

  const length = ctx.normalizedRequest?.length ?? ctx.request.length
  const maxImages = IMAGE_CAP_MAP[length] ?? 4

  let scenes: SceneSpec[] = []

  try {
    const router = getAIRouter()
    const response = await router.call({
      capability: "extract:scene-specs",
      systemPrompt: `You are a visual director for a children's picture book. Extract key visual moments from this story as scene specifications.

Return ONLY a valid JSON array (no markdown fences) with this EXACT structure for each scene:
[
  {
    "order": 0,
    "description": "What is happening in this scene",
    "characters": ["Character Name 1", "Character Name 2"],
    "setting": "Where the scene takes place",
    "mood": "The emotional tone of the scene",
    "lighting": "Lighting description (e.g. warm lamplight, moonlit, sunrise)",
    "imagePrompt": "A detailed image generation prompt for this scene",
    "warrantsIllustration": true
  }
]

RULES:
- You MUST return at least 1 scene. Every story has at least one illustratable moment.
- Select the most meaningful moments: emotional peaks, setting reveals, transformation moments, resolution moments
- Return at MOST ${maxImages} scenes. You may return fewer if the story doesn't warrant more.
- ALL returned scenes should have "warrantsIllustration": true
- "order" must be a number starting from 0
- "description" must be a string
- "characters" must be an array of character name strings
- "setting" must be a string
- "mood" must be a string
- "lighting" is optional but recommended
- "imagePrompt" is required — write a detailed, child-safe illustration prompt
- Do NOT wrap in markdown code fences`,
      userPrompt: `Extract scene specs from this story:\n${JSON.stringify(ctx.storyDraft.pages)}`,
      responseSchema: SceneSpecArraySchema,
      temperature: 0.5,
    })

    scenes = (response.output as SceneSpec[]) ?? []
  } catch (err) {
    console.error("[extract-scene-specs] AI extraction failed, using fallback:", (err as Error).message)
    // Fallback handled below
  }

  // Hard-enforce the image cap
  if (scenes.length > maxImages) {
    scenes = scenes.slice(0, maxImages)
  }

  // Ensure warrantsIllustration doesn't filter everything out
  const illustratable = scenes.filter((s) => s.warrantsIllustration !== false)
  if (illustratable.length === 0 && scenes.length > 0) {
    // AI set all to false — override the first one
    scenes[0].warrantsIllustration = true
  }

  // FALLBACK: If we still have zero scenes, synthesize from the story pages
  if (scenes.length === 0 && ctx.storyDraft.pages.length > 0) {
    console.warn("[extract-scene-specs] No scenes extracted, generating fallback from story pages")
    const pages = ctx.storyDraft.pages
    // Pick the middle page (emotional peak) and the last page (resolution)
    const peakIdx = Math.floor(pages.length / 2)
    const fallbackPages = pages.length === 1
      ? [pages[0]]
      : [pages[peakIdx], pages[pages.length - 1]]

    scenes = fallbackPages.slice(0, maxImages).map((page, i) => ({
      order: i,
      description: page.text.slice(0, 200),
      characters: [],
      setting: "Story scene",
      mood: "warm",
      lighting: "soft warm lighting",
      imagePrompt: `Children's bedtime storybook illustration. ${page.text.slice(0, 300)}. Soft, warm colors, gentle lighting, cozy atmosphere. Illustrated in a whimsical children's book style.`,
      warrantsIllustration: true,
    }))
  }

  ctx.sceneSpecs = scenes
  ctx.log.push({
    step: "extract-scene-specs",
    status: "completed",
    durationMs: Date.now() - start,
  })

  return ctx
}
