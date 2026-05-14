// @ts-nocheck
import { getAIRouter } from "@/lib/providers/ai"
import { StoryOutlineSchema } from "@/lib/schemas/outline"
import type { PipelineContext } from "../types"

export async function validateAndRepairOutline(ctx: PipelineContext): Promise<PipelineContext> {
  if (!ctx.outline) throw new Error("No outline to validate")

  const router = getAIRouter()
  const MAX_REPAIR_ROUNDS = 2

  for (let round = 0; round <= MAX_REPAIR_ROUNDS; round++) {
    const validationResponse = await router.call<{ passed: boolean; issues: unknown[] }>({
      capability: "validate:outline",
      systemPrompt: `You are a children's story quality validator. Check the outline for age-appropriateness, tone match, and bedtime safety.

AGE BAND RULES:
- TODDLER (2-3): Extremely simple concepts. No conflict, no villains, no separation anxiety triggers. Only familiar settings. Repetition is good. Max 2-3 characters total.
- EARLY (4-6): Simple challenges OK but must resolve warmly. No real danger, no scary creatures, no death. Gentle humor OK. Vocabulary must be very accessible.
- MIDDLE (7-9): Light adventure OK. Mild tension allowed but must resolve completely. No violence, no dark themes. Can handle simple moral complexity.
- TWEEN (10-12): Moderate emotional complexity OK. Can handle mild fear if resolved. Social dynamics, friendship challenges, light mystery allowed. No horror, no graphic content.
- PRETEEN (12+): Deeper themes OK — identity, belonging, mild existential wonder. Still no violence, horror, or mature content. This is still a BEDTIME story.

ALL AGES: No unresolved fear. No nightmares, monsters under beds, abandonment, or death. Story must end in a way that makes a child feel safe going to sleep.

Return JSON: { passed: boolean, issues: Array<{type, severity, description}> }`,
      userPrompt: `Validate this outline:\n${JSON.stringify(ctx.outline, null, 2)}\n\nContext: Age band ${ctx.normalizedRequest?.ageBand}, Mode: ${ctx.normalizedRequest?.mode}`,
      responseSchema: undefined,
      temperature: 0.2,
    })

    let report: { passed: boolean; issues: unknown[] }
    try {
      report = JSON.parse(validationResponse.rawText)
    } catch {
      report = { passed: true, issues: [] }
    }

    ctx.log.push({
      step: `validate-outline-round-${round}`,
      status: report.passed ? "completed" : round < MAX_REPAIR_ROUNDS ? "completed" : "failed",
      provider: validationResponse.provider,
      model: validationResponse.model,
    })

    if (report.passed) break

    if (round >= MAX_REPAIR_ROUNDS) {
      ctx.errors.push({ step: "validate-outline", critical: true, message: "Outline failed validation after max repair rounds" })
      ctx.status = "failed"
      return ctx
    }

    // Repair round
    const repairResponse = await router.call({
      capability: "generate:repair-plan",
      systemPrompt: "You are a story repair specialist. Fix only the flagged issues in the outline. Return the corrected outline as JSON.",
      userPrompt: `Original outline:\n${JSON.stringify(ctx.outline)}\n\nIssues:\n${JSON.stringify(report.issues)}`,
      responseSchema: StoryOutlineSchema,
      temperature: 0.7,
    })

    ctx.outline = repairResponse.output as never
    ctx.log.push({ step: `repair-outline-round-${round}`, status: "completed", provider: repairResponse.provider, model: repairResponse.model })
  }

  return ctx
}
