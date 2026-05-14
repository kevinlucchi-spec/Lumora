// @ts-nocheck
import { SceneSpecSchema } from "@/lib/schemas/scene"
import type { PipelineContext } from "../types"

export async function validateScenes(ctx: PipelineContext): Promise<PipelineContext> {
  if (!ctx.sceneSpecs) return ctx

  const valid = ctx.sceneSpecs.filter((spec) => {
    const result = SceneSpecSchema.safeParse(spec)
    return result.success
  })

  ctx.sceneSpecs = valid
  ctx.log.push({ step: "validate-scenes", status: "completed" })
  return ctx
}
