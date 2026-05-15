// @ts-nocheck
import { prisma } from "@/lib/prisma"
import type { PipelineContext } from "../types"

export async function persistAllOutputs(ctx: PipelineContext): Promise<PipelineContext> {
  const start = Date.now()
  const { storyDraft, normalizedRequest, sceneSpecs, imageAssets, runId } = ctx
  if (!storyDraft || !normalizedRequest) throw new Error("Missing story draft for persistence")

  const wordCount = storyDraft.pages.reduce((acc, p) => acc + p.text.split(/\s+/).length, 0)
  const readingTimeMin = Math.ceil(wordCount / 200)
  const finalTitle = normalizedRequest.storyTitle?.trim() || storyDraft.title

  // Use a transaction to batch all DB writes into fewer round-trips
  const story = await prisma.$transaction(async (tx) => {
    const existingStoryCount = await tx.story.count({
      where: { volumeId: normalizedRequest.volumeId },
    })

    const s = await tx.story.create({
      data: {
        volumeId: normalizedRequest.volumeId,
        title: finalTitle,
        content: storyDraft.pages,
        storyType: normalizedRequest.storyType === "continuation" ? "CONTINUATION" : "NEW",
        mode: normalizedRequest.mode as never,
        ageBand: normalizedRequest.ageBand as never,
        parentStoryId: normalizedRequest.parentStoryId ?? null,
        order: existingStoryCount + 1,
        readingTimeMin,
        wordCount,
      },
    })

    // Create scene specs
    const sceneSpecMap = new Map<number, string>()
    if (sceneSpecs && sceneSpecs.length > 0) {
      const created = await Promise.all(
        sceneSpecs.map((spec) =>
          tx.sceneSpec.create({
            data: {
              storyId: s.id,
              order: spec.order,
              description: spec.description,
              characters: spec.characters,
              setting: spec.setting,
              mood: spec.mood,
              lighting: spec.lighting,
              imagePrompt: spec.imagePrompt,
            },
          })
        )
      )
      created.forEach((c, i) => sceneSpecMap.set(sceneSpecs[i].order, c.id))
    }

    // Create image assets
    if (imageAssets && imageAssets.length > 0) {
      await Promise.all(
        imageAssets.map((asset) =>
          tx.imageAsset.create({
            data: {
              storyId: s.id,
              sceneSpecId: sceneSpecMap.get(asset.sceneOrder) ?? null,
              storageKey: asset.storageKey,
              url: asset.url,
              prompt: asset.prompt ?? "",
              negativePrompt: asset.negativePrompt,
              provider: asset.provider,
              model: asset.model,
              width: 1024,
              height: 1024,
              metadata: {},
            },
          })
        )
      )
    }

    await tx.generationRun.update({
      where: { id: runId },
      data: {
        storyId: s.id,
        completedAt: new Date(),
        finalOutput: {
          storyId: s.id,
          title: storyDraft.title,
          supportingCharacters: (ctx.outline as Record<string, unknown>)?.supportingCharacters ?? [],
        },
      },
    })

    return s
  })

  ctx.finalStory = { title: storyDraft.title, content: storyDraft.pages }
  ctx.log.push({ step: "persist-outputs", status: "completed", durationMs: Date.now() - start })
  return ctx
}
