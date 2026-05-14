// @ts-nocheck
import { getAIRouter } from "@/lib/providers/ai"
import type { PipelineContext } from "../types"

export async function validateContinuity(ctx: PipelineContext): Promise<PipelineContext> {
  const { storyDraft, contextPack, normalizedRequest } = ctx
  if (!storyDraft || !contextPack || !normalizedRequest) return ctx

  // Skip if no continuity context exists (first story in series)
  const hasMemory =
    contextPack.characterMemories.some((cm) => cm.recentEvents.length > 0 || Object.keys(cm.evolvingState).length > 0) ||
    Object.keys(contextPack.branchFacts.facts).length > 0 ||
    contextPack.recentStories.some((s) => s.summary) ||
    contextPack.parentStory !== undefined

  if (!hasMemory) {
    ctx.log.push({ step: "validate-continuity", status: "skipped" })
    return ctx
  }

  const start = Date.now()
  const router = getAIRouter()

  // Build context summary for the validator
  const contextSummary = buildContextSummary(ctx)

  const validationResponse = await router.call<{ passed: boolean; issues: unknown[] }>({
    capability: "validate:continuity",
    systemPrompt: `You are a story continuity checker for a children's bedtime story series. Your job is to find contradictions, inconsistencies, and continuity breaks between the new story and the established series context.

Check for:
1. Character personality/behavior contradictions (acting out of character)
2. Factual contradictions (events, locations, relationships that conflict with established facts)
3. Character relationship inconsistencies (characters who should know each other acting as strangers)
4. World-state contradictions (things that were established differently before)
5. For continuations: whether the story properly follows from the previous story

Do NOT flag:
- Natural character growth or change (that's good storytelling)
- New information that doesn't contradict existing facts
- Minor stylistic differences

Return JSON: { "passed": boolean, "issues": Array<{"type": "character"|"plot"|"world"|"relationship", "severity": "major"|"minor", "description": string, "suggestion": string}> }

Be strict on major contradictions, lenient on minor style differences.`,
    userPrompt: `SERIES CONTEXT:
${contextSummary}

NEW STORY TO CHECK:
Title: "${storyDraft.title}"
${storyDraft.pages.map((p) => p.text).join("\n\n")}

Check this story for continuity issues against the series context above.`,
    temperature: 0.2,
  })

  let report: { passed: boolean; issues: Array<{ type: string; severity: string; description: string; suggestion: string }> }
  try {
    report = JSON.parse(validationResponse.rawText)
  } catch {
    report = { passed: true, issues: [] }
  }

  ctx.log.push({
    step: "validate-continuity",
    status: "completed",
    durationMs: Date.now() - start,
    provider: validationResponse.provider,
    model: validationResponse.model,
  })

  // Only fail on major issues
  const majorIssues = report.issues.filter((i) => i.severity === "major")
  if (majorIssues.length > 0) {
    // Attempt repair via Claude
    const repairResponse = await router.call({
      capability: "generate:repair-plan",
      systemPrompt: `You are a story repair specialist. Fix continuity issues in a children's bedtime story while preserving the story's charm and flow. Return the complete corrected story as JSON with title and pages array. Make minimal changes — only fix what's flagged.`,
      userPrompt: `Story:\n${JSON.stringify(storyDraft)}\n\nContinuity issues to fix:\n${JSON.stringify(majorIssues)}\n\nSeries context:\n${contextSummary}`,
      temperature: 0.7,
    })

    try {
      ctx.storyDraft = JSON.parse(repairResponse.rawText)
      ctx.log.push({ step: "repair-continuity", status: "completed", provider: repairResponse.provider, model: repairResponse.model })
    } catch {
      // Keep existing draft if parse fails, log the issues
      ctx.log.push({ step: "repair-continuity", status: "failed" })
    }
  }

  return ctx
}

function buildContextSummary(ctx: PipelineContext): string {
  const { contextPack } = ctx
  if (!contextPack) return ""

  const parts: string[] = []

  // Character memories
  for (const cm of contextPack.characterMemories) {
    const lines = [`Character "${cm.characterName}":`]
    if (Object.keys(cm.stableFacts).length > 0) lines.push(`  Facts: ${JSON.stringify(cm.stableFacts)}`)
    if (Object.keys(cm.evolvingState).length > 0) lines.push(`  State: ${JSON.stringify(cm.evolvingState)}`)
    if (cm.recentEvents.length > 0) lines.push(`  History: ${cm.recentEvents.map((e) => e.summary).join("; ")}`)
    parts.push(lines.join("\n"))
  }

  // Branch facts
  if (Object.keys(contextPack.branchFacts.facts).length > 0) {
    parts.push(`Established facts: ${JSON.stringify(contextPack.branchFacts.facts)}`)
  }

  // Recent stories
  for (const s of contextPack.recentStories.filter((s) => s.summary)) {
    parts.push(`Previous story "${s.title}": ${s.summary}`)
  }

  // Parent story for continuations
  if (contextPack.parentStory) {
    const text = contextPack.parentStory.content.map((p) => p.text).join("\n\n")
    parts.push(`Direct predecessor "${contextPack.parentStory.title}":\n${text.slice(0, 3000)}`)
  }

  // World canon
  if (Object.keys(contextPack.worldCanon.rules).length > 0) {
    parts.push(`World rules: ${JSON.stringify(contextPack.worldCanon.rules)}`)
  }

  return parts.join("\n\n")
}
