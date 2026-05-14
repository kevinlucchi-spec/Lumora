// @ts-nocheck
import { prisma } from "@/lib/prisma"
import type { PipelineContext } from "../types"
import type { NormalizedRequest, ResolvedCharacter, ToneSpec } from "../types"

const WORD_COUNT_MAP: Record<string, Record<string, number>> = {
  quick:  { TODDLER: 150,  EARLY: 250,  MIDDLE: 350,  TWEEN: 400,  PRETEEN: 500  },
  short:  { TODDLER: 300,  EARLY: 450,  MIDDLE: 600,  TWEEN: 750,  PRETEEN: 900  },
  medium: { TODDLER: 500,  EARLY: 800,  MIDDLE: 1100, TWEEN: 1400, PRETEEN: 1700 },
  long:   { TODDLER: 800,  EARLY: 1200, MIDDLE: 1600, TWEEN: 2000, PRETEEN: 2500 },
}

/** Maximum illustration count per story length tier */
export const IMAGE_CAP_MAP: Record<string, number> = {
  quick: 2,
  short: 3,
  medium: 4,
  long: 6,
}

export async function normalizeRequest(ctx: PipelineContext): Promise<PipelineContext> {
  const start = Date.now()
  const { request } = ctx

  // ── Resolve characters ──
  const resolvedCharacters: ResolvedCharacter[] = []

  if (request.characterIds.length > 0) {
    const templates = await prisma.characterTemplate.findMany({
      where: { id: { in: request.characterIds } },
    })

    for (const template of templates) {
      let instance = await prisma.characterInstance.findUnique({
        where: {
          seriesId_characterTemplateId: {
            seriesId: request.seriesId,
            characterTemplateId: template.id,
          },
        },
        include: { characterMemory: true },
      })

      if (!instance) {
        instance = await prisma.characterInstance.create({
          data: {
            seriesId: request.seriesId,
            characterTemplateId: template.id,
            memoryState: {},
            characterMemory: {
              create: {
                stableFacts: {},
                evolvingState: {},
                eventLog: [],
              },
            },
          },
          include: { characterMemory: true },
        })
      }

      resolvedCharacters.push({
        instanceId: instance.id,
        templateId: template.id,
        name: instance.nameOverride ?? template.name,
        essence: template.essence as Record<string, unknown>,
        visualProfile: (template.visualProfile as Record<string, unknown>) ?? undefined,
        currentState: (instance.characterMemory?.evolvingState as Record<string, unknown>) ?? {},
      })
    }
  }

  // ── Resolve art style (library or custom) ──
  let resolvedArtStyle: NormalizedRequest["resolvedArtStyle"] | undefined
  let resolvedCustomArtStyle: string | undefined

  const artMode = request.artStyleMode ?? "auto"
  if (artMode === "library" && request.artStylePresetId) {
    const artStyle = await prisma.artStylePreset.findUnique({
      where: { id: request.artStylePresetId },
    })
    if (artStyle) {
      resolvedArtStyle = {
        styleKeywords: artStyle.styleKeywords as string[],
        medium: artStyle.medium ?? undefined,
        colorPalette: artStyle.colorPalette ?? undefined,
        negativeTerms: artStyle.negativeTerms as string[],
      }
    }
  } else if (artMode === "custom" && request.customArtStyle) {
    resolvedCustomArtStyle = request.customArtStyle
  }
  // artMode === "auto" → both undefined, AI will infer

  // ── Resolve world (library or custom) ──
  let resolvedWorld: { name: string; rules: Record<string, unknown>; toneGuide: Record<string, unknown> } | undefined
  let resolvedCustomWorld: string | undefined

  const worldMode = request.worldMode ?? "auto"
  if (worldMode === "library" && request.worldId) {
    const world = await prisma.worldTemplate.findUnique({
      where: { id: request.worldId },
    })
    if (world) {
      resolvedWorld = {
        name: world.name,
        rules: world.rules as Record<string, unknown>,
        toneGuide: world.toneGuide as Record<string, unknown>,
      }
    }
  } else if (worldMode === "custom" && request.customWorld) {
    resolvedCustomWorld = request.customWorld
  }
  // worldMode === "auto" → both undefined, AI will infer

  // ── Resolve story prompt (library, custom, or auto) ──
  let resolvedPrompt = ""
  const storyMode = request.storyIdeaMode ?? "auto"

  if (storyMode === "custom" && request.prompt?.trim()) {
    resolvedPrompt = request.prompt.trim()
  } else if (storyMode === "library" && request.promptSeedId) {
    const seed = await prisma.storyPromptSeed.findUnique({
      where: { id: request.promptSeedId },
      select: { prompt: true },
    })
    if (seed) resolvedPrompt = seed.prompt
  }
  // storyMode === "auto" → resolvedPrompt stays empty, AI generates premise

  const targetWordCount =
    WORD_COUNT_MAP[request.length]?.[request.ageBand] ?? 800

  const toneSpec: ToneSpec = {
    mode: request.mode,
    ageBand: request.ageBand,
    intensity: request.ageBand === "TODDLER" || request.ageBand === "EARLY" ? "very_low" : "low",
    vocabulary: request.ageBand === "TODDLER" ? "simple" : request.ageBand === "PRETEEN" ? "advanced" : "moderate",
    targetWordCount,
  }

  const normalizedRequest: NormalizedRequest = {
    ...request,
    resolvedCharacters,
    resolvedArtStyle,
    resolvedWorld,
    resolvedPrompt,
    resolvedCustomWorld,
    resolvedCustomArtStyle,
    targetWordCount,
    toneSpec,
  }

  ctx.normalizedRequest = normalizedRequest
  ctx.log.push({
    step: "normalize-request",
    status: "completed",
    durationMs: Date.now() - start,
  })

  return ctx
}
