// @ts-nocheck
import { prisma } from "@/lib/prisma"
import type { PipelineContext, PipelineStep } from "./types"
import type { StoryGenerationRequest } from "@/lib/schemas/request"

import { normalizeRequest } from "./steps/01-normalize-request"
import { retrieveContext } from "./steps/02-retrieve-context"
import { generateOutline } from "./steps/03-generate-outline"
import { validateAndRepairOutline } from "./steps/04-05-validate-repair-outline"
import { generateStoryDraft } from "./steps/06-generate-story-draft"
import { validateAndRepairStory } from "./steps/07-08-validate-repair-story"
import { validateContinuity } from "./steps/08b-validate-continuity"
import { extractSceneSpecs } from "./steps/09-extract-scene-specs"
import { validateScenes } from "./steps/10-validate-scenes"
import { enrichImagePrompts } from "./steps/10b-enrich-image-prompts"
import { generateImages } from "./steps/11-generate-images"
import { generateMissingPortraits } from "./steps/11b-generate-portraits"
import { qaAndRepairImages } from "./steps/12-qa-images"
import { updateMemoryState } from "./steps/13-update-memory"
import { persistAllOutputs } from "./steps/14-persist-outputs"

function initContext(
  request: StoryGenerationRequest,
  runId: string,
  userId: string,
): PipelineContext {
  return {
    runId,
    userId,
    request,
    log: [],
    errors: [],
    status: "running",
  }
}

async function persistRunLog(ctx: PipelineContext): Promise<void> {
  await prisma.generationRun.update({
    where: { id: ctx.runId },
    data: {
      providerLog: ctx.log as never,
      errors: ctx.errors as never,
      status:
        ctx.status === "running"
          ? "RUNNING"
          : ctx.status === "completed"
          ? "COMPLETED"
          : ctx.status === "failed"
          ? "FAILED"
          : "PARTIAL",
    },
  })
}

const PIPELINE_STEPS: PipelineStep[] = [
  normalizeRequest,        // 01: Resolve characters, derive word count, tone
  retrieveContext,         // 02: Fetch character/branch/world memory
  generateOutline,         // 03: Claude generates outline
  validateAndRepairOutline,// 04-05: GPT-4o validates, Claude repairs
  generateStoryDraft,      // 06: Claude generates full story
  validateAndRepairStory,  // 07-08: GPT-4o validates, Claude repairs
  validateContinuity,      // 08b: GPT-4o checks story against series memory, Claude repairs contradictions
  extractSceneSpecs,       // 09: Gemini extracts visual scenes
  validateScenes,          // 10: Zod validates scene specs
  enrichImagePrompts,      // 10b: Gemini enriches prompts with character visual profiles
  generateImages,          // 11: Image generation, uploads to R2
  generateMissingPortraits,// 11b: Auto-generate portraits for characters without one
  qaAndRepairImages,       // 12: GPT-4o scene QA + Grok character QA + Claude repair loop
  updateMemoryState,       // 13: Update character/branch memory
  persistAllOutputs,       // 14: Write everything to database
]

export async function runStoryPipeline(
  request: StoryGenerationRequest,
  runId: string,
  userId: string,
): Promise<PipelineContext> {
  let ctx = initContext(request, runId, userId)

  for (const step of PIPELINE_STEPS) {
    try {
      ctx = await step(ctx)
      await persistRunLog(ctx)
    } catch (err) {
      ctx.errors.push({
        step: step.name,
        critical: true,
        message: (err as Error).message,
      })
      ctx.status = "failed"
      await persistRunLog(ctx)
      break
    }

    if (ctx.status === "failed") break
  }

  if (ctx.status === "running") ctx.status = "completed"
  await persistRunLog(ctx)
  return ctx
}
