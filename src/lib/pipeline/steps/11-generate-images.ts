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

export async function generateImages(ctx: PipelineContext): Promise<PipelineContext> {
  if (!ctx.sceneSpecs || ctx.sceneSpecs.length === 0) {
    ctx.log.push({ step: "generate-images", status: "skipped" })
    return ctx
  }

  const length = ctx.normalizedRequest?.length ?? ctx.request.length
  const maxImages = IMAGE_CAP_MAP[length] ?? 4

  // Fetch portrait URLs once for all scenes
  const portraitUrls = await getPortraitUrls(ctx)

  const imageProvider = getImageProvider()
  const imageAssets = []
  const enrichedMap = new Map(
    (ctx._enrichedPrompts ?? []).map((ep) => [ep.order, ep]),
  )

  let generatedCount = 0
  for (const scene of ctx.sceneSpecs) {
    if (!scene.warrantsIllustration) continue
    if (generatedCount >= maxImages) break

    const enriched = enrichedMap.get(scene.order)
    const prompt = enriched?.enrichedPrompt ?? scene.imagePrompt ?? scene.description
    const negativePrompt = enriched?.negativePrompt

    try {
      const result = await imageProvider.generate({
        prompt,
        negativePrompt,
        referenceImageUrls: portraitUrls.length > 0 ? portraitUrls : undefined,
        metadata: { sceneOrder: scene.order },
      })

      let finalUrl = result.url
      let finalStorageKey = result.storageKey

      // Persist to R2 if configured (DALL-E URLs are ephemeral)
      if (R2_CONFIGURED && result.url) {
        const storageKey = `stories/${ctx.runId}/scene-${scene.order}-${Date.now()}.png`
        try {
          await downloadAndUpload(result.url, storageKey)
          finalStorageKey = storageKey
          finalUrl = storageKey
        } catch (uploadErr) {
          // First attempt failed — retry once after a short delay
          ctx.errors.push({
            step: "generate-images",
            critical: false,
            message: `R2 upload attempt 1 failed for scene ${scene.order}: ${(uploadErr as Error).message}`,
          })
          try {
            await new Promise((r) => setTimeout(r, 2000))
            await downloadAndUpload(result.url, storageKey)
            finalStorageKey = storageKey
            finalUrl = storageKey
          } catch {
            // Fall back to ephemeral URL — it will expire
            ctx.errors.push({
              step: "generate-images",
              critical: false,
              message: `R2 upload retry failed for scene ${scene.order}. Using ephemeral URL (will expire in ~1hr).`,
            })
          }
        }
      }

      imageAssets.push({
        sceneOrder: scene.order,
        storageKey: finalStorageKey,
        url: finalUrl,
        prompt,
        negativePrompt,
        provider: result.provider,
        model: result.model,
      })
      generatedCount++
    } catch (err) {
      ctx.errors.push({
        step: "generate-images",
        critical: false,
        message: `Image generation failed for scene ${scene.order}: ${(err as Error).message}`,
      })
    }
  }

  ctx.imageAssets = imageAssets
  if (imageAssets.length < ctx.sceneSpecs.filter((s) => s.warrantsIllustration).length) {
    ctx.status = "partial"
  }
  ctx.log.push({ step: "generate-images", status: "completed" })
  return ctx
}
