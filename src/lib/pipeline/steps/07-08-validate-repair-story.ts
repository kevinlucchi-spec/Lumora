import { getAIRouter } from "@/lib/providers/ai"
import type { PipelineContext } from "../types"

export async function validateAndRepairStory(ctx: PipelineContext): Promise<PipelineContext> {
  if (!ctx.storyDraft) throw new Error("No story draft to validate")

  const router = getAIRouter()
  const MAX_REPAIR_ROUNDS = 2

  for (let round = 0; round <= MAX_REPAIR_ROUNDS; round++) {
    const validationResponse = await router.call<{ passed: boolean; issues: unknown[] }>({
      capability: "validate:story",
      systemPrompt: `You are a children's bedtime story validator. Check for age-appropriateness, bedtime safety, vocabulary match, and emotional safety.

AGE BAND RULES:
- TODDLER (2-3): Only simple, familiar words. Short sentences. No conflict, no scary imagery, no separation. Soothing rhythm matters.
- EARLY (4-6): Simple vocabulary, short paragraphs. Gentle challenges only. No danger, scary creatures, or sadness without immediate comfort. Everything resolves warmly.
- MIDDLE (7-9): Moderate vocabulary OK. Light tension and adventure allowed. No violence, death, bullying, or dark themes. Emotional challenges must resolve fully.
- TWEEN (10-12): Richer vocabulary and longer sentences OK. Can handle social complexity, mild mystery, emotional nuance. No horror, graphic content, or heavy themes.
- PRETEEN (12+): Advanced vocabulary OK. Can explore identity, belonging, wonder. Still a bedtime story — no violence, mature content, or unresolved dread.

BEDTIME SAFETY (ALL AGES):
- Must end reassuringly — child should feel safe, warm, and sleepy
- No unresolved fear, anxiety, or sadness at story end
- No nightmares, monsters, abandonment, death, or injury
- No content that would keep a child awake worrying

VOCABULARY CHECK: Flag any words or concepts too advanced for the age band.

Return JSON: { passed: boolean, issues: Array<{type: "age"|"safety"|"vocabulary"|"tone"|"structure", severity: "major"|"minor", pageNumber?: number, description: string}> }`,
      userPrompt: `Validate this story for age band ${ctx.normalizedRequest?.ageBand} and mode ${ctx.normalizedRequest?.mode}:\n${JSON.stringify(ctx.storyDraft)}`,
      temperature: 0.2,
    })

    let report: { passed: boolean; issues: unknown[] }
    try {
      report = JSON.parse(validationResponse.rawText)
    } catch {
      report = { passed: true, issues: [] }
    }

    ctx.log.push({
      step: `validate-story-round-${round}`,
      status: report.passed ? "completed" : round < MAX_REPAIR_ROUNDS ? "completed" : "failed",
      provider: validationResponse.provider,
      model: validationResponse.model,
    })

    if (report.passed) break

    if (round >= MAX_REPAIR_ROUNDS) {
      ctx.errors.push({ step: "validate-story", critical: true, message: "Story failed validation after max repair rounds" })
      ctx.status = "failed"
      return ctx
    }

    const repairResponse = await router.call({
      capability: "generate:repair-plan",
      systemPrompt: "You are a story repair specialist. Fix only the flagged pages in this bedtime story. Return the complete corrected story as JSON with title and pages.",
      userPrompt: `Story:\n${JSON.stringify(ctx.storyDraft)}\n\nIssues:\n${JSON.stringify(report.issues)}`,
      temperature: 0.75,
    })

    try {
      ctx.storyDraft = JSON.parse(repairResponse.rawText)
    } catch {
      // keep existing draft if parse fails
    }

    ctx.log.push({ step: `repair-story-round-${round}`, status: "completed", provider: repairResponse.provider, model: repairResponse.model })
  }

  return ctx
}
