import { prisma } from "@/lib/prisma"
import type { PipelineContext } from "../types"

export async function persistAllOutputs(ctx: PipelineContext): Promise<PipelineContext> {
  const start = Date.now()
  const { storyDraft, normalizedRequest, sceneSpecs, imageAssets, runId } = ctx
  if (!storyDraft || !normalizedRequest) throw new Error("Missing story draft for persistence")

  const wordCount = storyDraft.pages.reduce((acc, p) => acc + p.text.split(/\s+/).length, 0)
  const readingTimeMin = Math.ceil(wordCount / 200)

  const existingStoryCount = await prisma.story.count({
    where: { volumeId: normalizedRequest.volumeId },
  })

  // Use user-provided title if set, otherwise fall back to AI-generated title
  const finalTitle = normalizedRequest.storyTitle?.trim() || storyDraft.title

  const story = await prisma.story.create({
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

  // Create scene specs and collect their IDs for linking image assets
  const sceneSpecMap = new Map<number, string>() // order → sceneSpec ID
  if (sceneSpecs && sceneSpecs.length > 0) {
    for (const spec of sceneSpecs) {
      const created = await prisma.sceneSpec.create({
        data: {
          storyId: story.id,
          order: spec.order,
          description: spec.description,
          characters: spec.characters,
          setting: spec.setting,
          mood: spec.mood,
          lighting: spec.lighting,
          imagePrompt: spec.imagePrompt,
        },
      })
      sceneSpecMap.set(spec.order, created.id)
    }
  }

  // Create image assets linked to their scene specs
  if (imageAssets && imageAssets.length > 0) {
    for (const asset of imageAssets) {
      await prisma.imageAsset.create({
        data: {
          storyId: story.id,
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
    }
  }

  await prisma.generationRun.update({
    where: { id: runId },
    data: {
      storyId: story.id,
      completedAt: new Date(),
      finalOutput: {
        storyId: story.id,
        title: storyDraft.title,
        supportingCharacters: (ctx.outline as Record<string, unknown>)?.supportingCharacters ?? [],
      },
    },
  })

  ctx.finalStory = { title: storyDraft.title, content: storyDraft.pages }
  ctx.log.push({ step: "persist-outputs", status: "completed", durationMs: Date.now() - start })
  return ctx
}
