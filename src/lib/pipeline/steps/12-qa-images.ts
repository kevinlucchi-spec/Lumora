// @ts-nocheck
import { getAIRouter } from "@/lib/providers/ai"
import { getImageProvider } from "@/lib/providers/image"
import { downloadAndUpload, getSignedReadUrl } from "@/lib/storage/r2"
import { prisma } from "@/lib/prisma"
import { visualProfileToPromptFragment, VisualProfileSchema } from "@/lib/schemas/visual-profile"
import { z } from "zod"
import type { PipelineContext, ImageAssetRef } from "../types"

const MAX_REPAIR_ROUNDS = 2
const R2_CONFIGURED = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_BUCKET)

const SceneQAResultSchema = z.object({
  passed: z.boolean(),
  issues: z.array(
    z.object({
      type: z.enum(["setting", "mood", "lighting", "composition", "other"]),
      description: z.string(),
      severity: z.enum(["minor", "major"]),
    }),
  ),
})

const CharacterQAResultSchema = z.object({
  passed: z.boolean(),
  issues: z.array(
    z.object({
      characterName: z.string(),
      type: z.enum(["appearance", "clothing", "features", "proportions", "missing", "other"]),
      description: z.string(),
      severity: z.enum(["minor", "major"]),
    }),
  ),
})

const RepairPromptSchema = z.object({
  repairedPrompt: z.string(),
  negativePrompt: z.string().optional(),
  repairNotes: z.string(),
})

/**
 * Step 12: Multi-AI image QA + repair loop.
 * - Gemini Pro checks scene accuracy (setting, mood, lighting)
 * - Grok checks character consistency against visual profiles
 * - If either has major issues, Claude rewrites the image prompt and we regenerate
 * - Max 2 repair rounds per image
 */
export async function qaAndRepairImages(ctx: PipelineContext): Promise<PipelineContext> {
  const start = Date.now()
  if (!ctx.imageAssets || ctx.imageAssets.length === 0) {
    ctx.log.push({ step: "qa-images", status: "skipped" })
    return ctx
  }

  // Build character visual reference for QA
  const characterRefs = buildCharacterRefs(ctx)
  const router = getAIRouter()
  const repairedAssets: ImageAssetRef[] = []

  for (const asset of ctx.imageAssets) {
    const scene = ctx.sceneSpecs?.find((s) => s.order === asset.sceneOrder)
    if (!scene) {
      repairedAssets.push(asset)
      continue
    }

    let currentAsset = asset
    let repairRound = 0

    while (repairRound < MAX_REPAIR_ROUNDS) {
      // Run both QA checks in parallel
      const [sceneQA, characterQA] = await Promise.allSettled([
        runSceneQA(router, scene, currentAsset),
        characterRefs.length > 0
          ? runCharacterQA(router, scene, currentAsset, characterRefs)
          : Promise.resolve({ passed: true, issues: [] }),
      ])

      const sceneResult = sceneQA.status === "fulfilled" ? sceneQA.value : { passed: true, issues: [] }
      const charResult = characterQA.status === "fulfilled" ? characterQA.value : { passed: true, issues: [] }

      const hasMajorSceneIssues = sceneResult.issues.some((i: { severity: string }) => i.severity === "major")
      const hasMajorCharIssues = charResult.issues.some((i: { severity: string }) => i.severity === "major")

      if (!hasMajorSceneIssues && !hasMajorCharIssues) {
        // Passed QA
        break
      }

      // Repair needed — Claude rewrites the prompt
      repairRound++
      ctx.log.push({
        step: `qa-images-repair-round-${repairRound}`,
        status: "started",
      })

      try {
        const allIssues = [
          ...sceneResult.issues.map((i: { type: string; description: string }) => `Scene: ${i.type} — ${i.description}`),
          ...charResult.issues.map((i: { characterName: string; type: string; description: string }) => `Character (${i.characterName}): ${i.type} — ${i.description}`),
        ]

        const repairResponse = await router.call({
          capability: "generate:image-prompt-repair",
          systemPrompt: `You are an image prompt engineer. An AI-generated illustration failed quality checks. Rewrite the image prompt to fix the identified issues while keeping everything else the same. Return JSON.`,
          userPrompt: `Original prompt: ${currentAsset.prompt ?? scene.imagePrompt ?? scene.description}

QA ISSUES FOUND:
${allIssues.join("\n")}

CHARACTER VISUAL REFERENCES:
${characterRefs.join("\n\n")}

Scene description: ${scene.description}
Setting: ${scene.setting}
Mood: ${scene.mood}
Lighting: ${scene.lighting ?? "not specified"}

Rewrite the prompt to fix these issues. Return JSON: { "repairedPrompt": "...", "negativePrompt": "...", "repairNotes": "..." }`,
          responseSchema: RepairPromptSchema,
          temperature: 0.4,
        })

        const repair = repairResponse.output as z.infer<typeof RepairPromptSchema>

        // Regenerate the image with repaired prompt
        const imageProvider = getImageProvider()
        const newImage = await imageProvider.generate({
          prompt: repair.repairedPrompt,
          negativePrompt: repair.negativePrompt,
          metadata: { sceneOrder: scene.order, repairRound },
        })

        let finalUrl = newImage.url
        let finalStorageKey = newImage.storageKey

        if (R2_CONFIGURED && newImage.url) {
          try {
            const storageKey = `stories/${ctx.runId}/scene-${scene.order}-repair${repairRound}-${Date.now()}.png`
            await downloadAndUpload(newImage.url, storageKey)
            finalStorageKey = storageKey
            finalUrl = storageKey
          } catch {
            // Fall back to ephemeral URL
          }
        }

        currentAsset = {
          sceneOrder: scene.order,
          storageKey: finalStorageKey,
          url: finalUrl,
          prompt: repair.repairedPrompt,
          negativePrompt: repair.negativePrompt,
          provider: newImage.provider,
          model: newImage.model,
        }

        ctx.log.push({
          step: `qa-images-repair-round-${repairRound}`,
          status: "completed",
        })
      } catch (err) {
        ctx.errors.push({
          step: "qa-images",
          critical: false,
          message: `Image repair round ${repairRound} failed for scene ${scene.order}: ${(err as Error).message}`,
        })
        break
      }
    }

    repairedAssets.push(currentAsset)
  }

  // Cross-scene consistency check — compare all images against portrait + each other
  const consistencyResult = await runCrossSceneConsistency(router, repairedAssets, ctx)
  ctx.imageAssets = consistencyResult

  ctx.log.push({
    step: "qa-images",
    status: "completed",
    durationMs: Date.now() - start,
  })

  return ctx
}

/**
 * Cross-scene consistency: GPT-4o sees all scene images + portrait,
 * identifies the best match to the portrait, and flags drifted images
 * for regeneration with the best match as the new reference.
 */
async function runCrossSceneConsistency(
  router: ReturnType<typeof getAIRouter>,
  assets: ImageAssetRef[],
  ctx: PipelineContext,
): Promise<ImageAssetRef[]> {
  if (assets.length <= 1) return assets

  // Resolve all image URLs
  const imageUrls: Array<{ order: number; url: string }> = []
  for (const asset of assets) {
    const url = await resolveImageUrl(asset)
    if (url) imageUrls.push({ order: asset.sceneOrder, url })
  }
  if (imageUrls.length <= 1) return assets

  // Get portrait URL as the canonical reference
  let portraitUrl: string | undefined
  if (ctx.normalizedRequest?.resolvedCharacters.length) {
    for (const char of ctx.normalizedRequest.resolvedCharacters) {
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
            portraitUrl = await resolveImageUrl({ url: portrait.url } as ImageAssetRef)
            if (portraitUrl) break
          }
        }
      } catch { /* skip */ }
    }
  }

  // Build the vision request with all images
  const allUrls = portraitUrl
    ? [portraitUrl, ...imageUrls.map((i) => i.url)]
    : imageUrls.map((i) => i.url)

  const sceneLabels = imageUrls.map((i) => `Scene ${i.order}`).join(", ")

  try {
    const response = await router.call({
      capability: "qa:image-scene",
      systemPrompt: `You are a character consistency checker for illustrated children's stories. You will see multiple scene images from the same story${portraitUrl ? " plus a character portrait reference (first image)" : ""}.

Your job:
1. Compare all scene images to ${portraitUrl ? "the portrait reference and " : ""}each other
2. Check if the SAME character looks consistent across all scenes — same face shape, skin tone, hair, clothing, proportions, age
3. Identify which scene image is the CLOSEST MATCH to the ${portraitUrl ? "portrait" : "majority character design"}
4. Flag any scenes where the character looks different (wrong age, different face, different clothing, wrong proportions)

Return JSON:
{
  "consistent": true/false,
  "bestMatchScene": <scene order number of the image closest to the portrait/canonical design>,
  "driftedScenes": [
    { "sceneOrder": <number>, "issues": "description of how this scene differs from the best match" }
  ]
}

CRITICAL: For library characters (those with portraits/profiles), their age is defined by their profile, NOT the audience age band. A 7-year-old library character must look 7 in every scene. Age drift for library characters is always a major issue. Story-generated characters can be any appropriate age.

Flag scenes with OBVIOUS visual differences — different age, different face shape, wrong skin tone, missing key features like glasses or hair style. Minor pose/angle differences are fine.`,
      userPrompt: `${portraitUrl ? "Image 0 is the CHARACTER PORTRAIT (canonical reference).\n" : ""}Scene images: ${sceneLabels}\n\nCheck character consistency across all these images.`,
      imageUrls: allUrls,
      responseSchema: undefined,
      temperature: 0.2,
    })

    let result: { consistent: boolean; bestMatchScene: number; driftedScenes: Array<{ sceneOrder: number; issues: string }> }
    try {
      const raw = response.rawText.trim()
      const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
      const jsonStr = fenceMatch ? fenceMatch[1].trim() : raw
      const start = jsonStr.indexOf("{")
      const end = jsonStr.lastIndexOf("}")
      result = JSON.parse(start >= 0 && end > start ? jsonStr.slice(start, end + 1) : jsonStr)
    } catch {
      return assets // can't parse — keep as-is
    }

    ctx.log.push({
      step: "qa-cross-scene-consistency",
      status: result.consistent ? "completed" : "completed",
      provider: response.provider,
      model: response.model,
    })

    if (result.consistent || !result.driftedScenes?.length) return assets

    console.log(`[qa-images] Cross-scene drift detected. Best match: scene ${result.bestMatchScene}. Drifted: ${result.driftedScenes.map((d) => d.sceneOrder).join(", ")}`)

    // Get the best match image URL as reference for regeneration
    const bestMatchAsset = assets.find((a) => a.sceneOrder === result.bestMatchScene)
    const bestMatchUrl = bestMatchAsset ? await resolveImageUrl(bestMatchAsset) : portraitUrl

    // Regenerate drifted scenes with the best match + portrait as references
    const referenceUrls = [bestMatchUrl, portraitUrl].filter(Boolean) as string[]
    if (referenceUrls.length === 0) return assets

    const imageProvider = getImageProvider()
    const finalAssets = [...assets]

    for (const drift of result.driftedScenes) {
      const assetIdx = finalAssets.findIndex((a) => a.sceneOrder === drift.sceneOrder)
      if (assetIdx === -1) continue

      const scene = ctx.sceneSpecs?.find((s) => s.order === drift.sceneOrder)
      if (!scene) continue

      const originalAsset = finalAssets[assetIdx]
      const enriched = ctx._enrichedPrompts?.find((ep) => ep.order === drift.sceneOrder)
      const prompt = enriched?.enrichedPrompt ?? originalAsset.prompt ?? scene.description

      try {
        const newImage = await imageProvider.generate({
          prompt: `${prompt}. CRITICAL: The character must look EXACTLY like the reference image — same face, same age, same proportions, same clothing, same skin tone.`,
          negativePrompt: enriched?.negativePrompt,
          referenceImageUrls: referenceUrls,
          metadata: { sceneOrder: drift.sceneOrder, crossSceneRepair: true },
        })

        let finalUrl = newImage.url
        let finalStorageKey = newImage.storageKey

        if (R2_CONFIGURED && newImage.url) {
          try {
            const storageKey = `stories/${ctx.runId}/scene-${drift.sceneOrder}-consistency-${Date.now()}.png`
            await downloadAndUpload(newImage.url, storageKey)
            finalStorageKey = storageKey
            finalUrl = storageKey
          } catch { /* keep ephemeral */ }
        }

        finalAssets[assetIdx] = {
          sceneOrder: drift.sceneOrder,
          storageKey: finalStorageKey,
          url: finalUrl,
          prompt: originalAsset.prompt,
          negativePrompt: originalAsset.negativePrompt,
          provider: newImage.provider,
          model: newImage.model,
        }

        ctx.log.push({ step: `qa-cross-scene-repair-${drift.sceneOrder}`, status: "completed" })
      } catch (err) {
        ctx.errors.push({
          step: "qa-cross-scene-consistency",
          critical: false,
          message: `Cross-scene repair failed for scene ${drift.sceneOrder}: ${(err as Error).message}`,
        })
      }
    }

    return finalAssets
  } catch (err) {
    ctx.errors.push({
      step: "qa-cross-scene-consistency",
      critical: false,
      message: `Cross-scene check failed: ${(err as Error).message}`,
    })
    return assets
  }
}

function buildCharacterRefs(ctx: PipelineContext): string[] {
  const refs: string[] = []
  if (!ctx.normalizedRequest?.resolvedCharacters) return refs

  for (const char of ctx.normalizedRequest.resolvedCharacters) {
    const rawProfile = (char as unknown as { visualProfile?: unknown }).visualProfile
    if (rawProfile) {
      const parsed = VisualProfileSchema.safeParse(rawProfile)
      if (parsed.success) {
        refs.push(visualProfileToPromptFragment(char.name, parsed.data))
      }
    }
  }
  return refs
}

async function resolveImageUrl(asset: ImageAssetRef): Promise<string | undefined> {
  const url = asset.url
  if (!url) return undefined
  // Already an HTTP/data URL — usable directly
  if (url.startsWith("http") || url.startsWith("data:")) return url
  // R2 storage key — generate a signed URL
  try {
    return await getSignedReadUrl(url, 300) // 5 min expiry
  } catch {
    return undefined
  }
}

async function runSceneQA(
  router: ReturnType<typeof getAIRouter>,
  scene: { description: string; setting: string; mood: string; lighting?: string },
  asset: ImageAssetRef,
) {
  const imageUrl = await resolveImageUrl(asset)
  const hasImage = !!imageUrl

  const response = await router.call({
    capability: "qa:image-scene",
    systemPrompt: `You are an illustration quality checker for children's picture books. Evaluate whether a generated image matches its scene specification. Be strict about setting, mood, and lighting — these must match. Return JSON.`,
    userPrompt: `SCENE SPECIFICATION:
- Description: ${scene.description}
- Setting: ${scene.setting}
- Mood: ${scene.mood}
- Lighting: ${scene.lighting ?? "not specified"}

IMAGE PROMPT USED: ${asset.prompt ?? "not available"}

${hasImage ? "The actual generated image is attached. Evaluate the IMAGE ITSELF against the scene specification." : "No image available — evaluate based on whether the prompt is likely to produce an image matching the scene spec."}

Return JSON:
{ "passed": true/false, "issues": [{ "type": "setting|mood|lighting|composition|other", "description": "...", "severity": "minor|major" }] }`,
    imageUrls: hasImage ? [imageUrl!] : undefined,
    responseSchema: SceneQAResultSchema,
    temperature: 0.3,
  })
  return response.output as z.infer<typeof SceneQAResultSchema>
}

async function runCharacterQA(
  router: ReturnType<typeof getAIRouter>,
  scene: { characters: string[] },
  asset: ImageAssetRef,
  characterRefs: string[],
) {
  const imageUrl = await resolveImageUrl(asset)
  const hasImage = !!imageUrl

  const response = await router.call({
    capability: "qa:image-character",
    systemPrompt: `You are a character consistency checker for children's illustrated stories. Your job is to verify that characters in the image match their visual profiles exactly. Characters MUST look the same across all illustrations.

CRITICAL: For library characters (those with visual profiles), their age is defined by their profile, NOT the audience age band. If the profile says "7 years old", the character must look 7 — not 10, not 12. Age drift for library characters is a MAJOR issue. Story-generated supporting characters can be any age that fits the story. Return JSON.`,
    userPrompt: `CHARACTERS IN THIS SCENE: ${scene.characters.join(", ")}

CHARACTER VISUAL PROFILES:
${characterRefs.join("\n\n")}

IMAGE PROMPT USED: ${asset.prompt ?? "not available"}

${hasImage ? "The actual generated image is attached. Check the IMAGE ITSELF — do the characters match their visual profiles? Look for wrong colors, missing features, incorrect clothing, or missing characters." : "No image available — evaluate based on whether the prompt accurately describes each character's visual details."}

Return JSON:
{ "passed": true/false, "issues": [{ "characterName": "...", "type": "appearance|clothing|features|proportions|missing|other", "description": "...", "severity": "minor|major" }] }`,
    imageUrls: hasImage ? [imageUrl!] : undefined,
    responseSchema: CharacterQAResultSchema,
    temperature: 0.3,
  })
  return response.output as z.infer<typeof CharacterQAResultSchema>
}
