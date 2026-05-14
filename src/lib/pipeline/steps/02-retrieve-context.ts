// @ts-nocheck
import { getCharacterMemorySnapshots } from "@/lib/memory/character-memory"
import { getBranchMemorySnapshot } from "@/lib/memory/branch-memory"
import { getWorldCanonSnapshot } from "@/lib/memory/world-canon"
import { prisma } from "@/lib/prisma"
import type { PipelineContext } from "../types"
import type { ContextPack, ToneGuide, ParentStoryContext } from "@/lib/memory/types"

export async function retrieveContext(ctx: PipelineContext): Promise<PipelineContext> {
  const start = Date.now()
  const { normalizedRequest } = ctx
  if (!normalizedRequest) throw new Error("normalizedRequest missing")

  const [characterMemories, branchFacts, worldCanon] = await Promise.all([
    getCharacterMemorySnapshots(normalizedRequest.characterIds),
    getBranchMemorySnapshot(normalizedRequest.branchId),
    (async () => {
      const branch = await prisma.branch.findUnique({
        where: { id: normalizedRequest.branchId },
        select: { seriesId: true },
      })
      return getWorldCanonSnapshot(branch?.seriesId ?? normalizedRequest.seriesId)
    })(),
  ])

  const recentStories = await prisma.story.findMany({
    where: { volume: { branchId: normalizedRequest.branchId }, archivedAt: null },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true, content: true, mode: true, createdAt: true },
  })

  // Load parent story for continuations
  let parentStory: ParentStoryContext | undefined
  if (normalizedRequest.storyType === "continuation" && normalizedRequest.parentStoryId) {
    const parent = await prisma.story.findUnique({
      where: { id: normalizedRequest.parentStoryId },
      select: { id: true, title: true, content: true, mode: true, ageBand: true },
    })
    if (parent) {
      parentStory = {
        storyId: parent.id,
        title: parent.title,
        content: parent.content as Array<{ pageNumber: number; text: string }>,
        mode: parent.mode,
        ageBand: parent.ageBand,
      }
    }
  }

  const toneGuide: ToneGuide = {
    mode: normalizedRequest.mode,
    ageBand: normalizedRequest.ageBand,
    intensity: normalizedRequest.toneSpec.intensity,
    vocabulary: normalizedRequest.toneSpec.vocabulary,
    endingStyle: "reassuring",
  }

  const contextPack: ContextPack = {
    characterMemories,
    branchFacts,
    worldCanon,
    recentStories: recentStories.map((s) => {
      const pages = s.content as Array<{ pageNumber: number; text: string }>
      const fullText = pages.map((p) => p.text).join(" ")
      // Generate a brief summary from the first ~300 chars of the story
      const summary = fullText.length > 300 ? fullText.slice(0, 300) + "..." : fullText
      return {
        storyId: s.id,
        title: s.title,
        summary,
        mode: s.mode,
        createdAt: s.createdAt.toISOString(),
      }
    }),
    toneGuide,
    parentStory,
  }

  ctx.contextPack = contextPack
  ctx.log.push({
    step: "retrieve-context",
    status: "completed",
    durationMs: Date.now() - start,
  })

  return ctx
}
