// @ts-nocheck
import { getImageProvider } from "@/lib/providers/image"
import { downloadAndUpload, getSignedReadUrl } from "@/lib/storage/r2"
import { prisma } from "@/lib/prisma"
import { IMAGE_CAP_MAP } from "./01-normalize-request"
import type { PipelineContext } from "../types"

const R2_CONFIGURED = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_BUCKET)

/** Resolve portrait URLs for all characters that have one */
async function getPortraitUrls(ctx: PipelineContext): Promise<string[]> {
  const urls: string[] = []
  if (!ctx.normalizedRequest?.resolvedCharacters) return urls

  for (const char of ctx.normalizedRequest.resolvedCharacters) {
    try {
      const template = await prisma.characterTemplate.findUnique({
        where: { id: char.templateId },
        select: { portraitAssetId: true },
      })
      if (!template?.portraitAssetId) continue
      const portrait = await prisma.imageAsset.findUnique({
        where: { id: template.portraitAssetId },
        select: { url: true },
      })
      if (!portrait) continue
      if (portrait.url.startsWith("http") || portrait.url.startsWith("data:")) {
        urls.push(portrait.url)
      } else {
        const signed = await getSignedReadUrl(portrait.url, 300).catch(() => null)
        if (signed) urls.push(signed)
      }
    } catch { /* skip */ }
  }
  return urls
}

/** Generate a single image and upload to R2 */
async function generateSingleImage(
  scene: { order: number; imagePrompt?: string; description: string },
  enrichedPrompt: string | undefined,
  negativePrompt: string | undefined,
  portraitUrls: string[],
  runId: string,
  ctx: PipelineContext,
) {
  const imageProvider = getImageProvider()
  const prompt = enrichedPrompt ?? scene.imagePrompt ?? scene.description

  const result = await imageProvider.generate({
    prompt,
    negativePrompt,
    referenceImageUrls: portraitUrls.length > 0 ? portraitUrls : undefined,
    metadata: { sceneOrder: scene.order },
  })

  let finalUrl = result.url
  let finalStorageKey = result.storageKey

  if (R2_CONFIGURED && result.url) {
    const storageKey = `stories/${runId}/scene-${scene.order}-${Date.now()}.png`
    try {
      await downloadAndUpload(result.url, storageKey)
      finalStorageKey = storageKey
      finalUrl = storageKey
    } catch {
      // Fall back to ephemeral URL
      ctx.errors.push({
        step: "generate-images",
        critical: false,
        message: `R2 upload failed for scene ${scene.order}. Using ephemeral URL.`,
      })
    }
  }

  return {
    sceneOrder: scene.order,
    storageKey: finalStorageKey,
    url: finalUrl,
    prompt,
    negativePrompt,
    provider: result.provider,
    model: result.model,
  }
}

export async function generateImages(ctx: PipelineContext): Promise<PipelineContext> {
  if (!ctx.sceneSpecs || ctx.sceneSpecs.length === 0) {
    ctx.log.push({ step: "generate-images", status: "skipped" })
    return ctx
  }

  const start = Date.now()
  const length = ctx.normalizedRequest?.length ?? ctx.request.length
  const maxImages = Math.min(IMAGE_CAP_MAP[length] ?? 4, 3) // Cap at 3 for speed

  const portraitUrls = await getPortraitUrls(ctx)
  const enrichedMap = new Map(
    (ctx._enrichedPrompts ?? []).map((ep) => [ep.order, ep]),
  )

  // Select scenes to illustrate
  const scenesToIllustrate = ctx.sceneSpecs
    .filter((s) => s.warrantsIllustration)
    .slice(0, maxImages)

  // Generate all images in parallel
  const results = await Promise.allSettled(
    scenesToIllustrate.map((scene) => {
      const enriched = enrichedMap.get(scene.order)
      return generateSingleImage(
        scene,
        enriched?.enrichedPrompt,
        enriched?.negativePrompt,
        portraitUrls,
        ctx.runId,
        ctx,
      )
    })
  )

  const imageAssets = []
  for (const result of results) {
    if (result.status === "fulfilled") {
      imageAssets.push(result.value)
    } else {
      ctx.errors.push({
        step: "generate-images",
        critical: false,
        message: `Image generation failed: ${result.reason?.message ?? "unknown error"}`,
      })
    }
  }

  ctx.imageAssets = imageAssets
  if (imageAssets.length < scenesToIllustrate.length) {
    ctx.status = "partial"
  }
  ctx.log.push({ step: "generate-images", status: "completed", durationMs: Date.now() - start })
  return ctx
}
