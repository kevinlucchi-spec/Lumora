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

/**
 * Full pipeline — all validation, repair, and QA steps.
 * Use when running on a long-lived server with no time constraints.
 */
const FULL_PIPELINE: PipelineStep[] = [
  normalizeRequest,        // 01
  retrieveContext,         // 02
  generateOutline,         // 03
  validateAndRepairOutline,// 04-05
  generateStoryDraft,      // 06
  validateAndRepairStory,  // 07-08
  validateContinuity,      // 08b
  extractSceneSpecs,       // 09
  validateScenes,          // 10
  enrichImagePrompts,      // 10b
  generateImages,          // 11
  generateMissingPortraits,// 11b
  qaAndRepairImages,       // 12
  updateMemoryState,       // 13
  persistAllOutputs,       // 14
]

/**
 * Lean pipeline — skips multi-AI validation, repair loops, and image QA.
 * Fits within Vercel Hobby's 60-second function timeout.
 *
 * Skipped steps:
 * - 04-05: Outline validation/repair (Claude already writes good outlines)
 * - 07-08: Story validation/repair (safety rules baked into the generation prompt)
 * - 08b:   Continuity validation (context is already in the generation prompt)
 * - 11b:   Portrait generation (defer to character creation time)
 * - 12:    Image QA + repair loops (the biggest time sink — 30-60s alone)
 */
const LEAN_PIPELINE: PipelineStep[] = [
  normalizeRequest,        // 01: ~1s
  retrieveContext,         // 02: ~2s
  generateOutline,         // 03: ~5-8s
  generateStoryDraft,      // 06: ~10-15s
  extractSceneSpecs,       // 09: ~3-5s
  validateScenes,          // 10: ~0.1s (Zod only)
  enrichImagePrompts,      // 10b: ~3-5s
  generateImages,          // 11: ~10-15s (parallel)
  updateMemoryState,       // 13: ~1s
  persistAllOutputs,       // 14: ~2s
]
// Estimated total: ~35-50s — within 60s budget

function selectPipeline(): PipelineStep[] {
  // Use lean pipeline on Vercel (serverless) or when explicitly set
  const isVercel = !!process.env.VERCEL
  const forceLean = process.env.PIPELINE_MODE === "lean"
  const forceFull = process.env.PIPELINE_MODE === "full"

  if (forceFull) return FULL_PIPELINE
  if (forceLean || isVercel) return LEAN_PIPELINE
  return FULL_PIPELINE
}

export async function runStoryPipeline(
  request: StoryGenerationRequest,
  runId: string,
  userId: string,
): Promise<PipelineContext> {
  let ctx = initContext(request, runId, userId)
  const steps = selectPipeline()

  for (const step of steps) {
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
