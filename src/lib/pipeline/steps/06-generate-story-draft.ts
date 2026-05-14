import { getAIRouter } from "@/lib/providers/ai"
import type { PipelineContext, StoryDraft } from "../types"
import type { ContextPack } from "@/lib/memory/types"
import { z } from "zod"

const StoryDraftSchema = z.object({
  title: z.string(),
  pages: z.array(z.object({
    pageNumber: z.number(),
    text: z.string(),
    sceneHint: z.string().optional(),
  })),
})

export async function generateStoryDraft(ctx: PipelineContext): Promise<PipelineContext> {
  const start = Date.now()
  const { outline, contextPack, normalizedRequest } = ctx
  if (!outline || !contextPack || !normalizedRequest) throw new Error("Missing context for story generation")

  // Build character block: core characters + any supporting characters from outline
  const coreCharacterLines = normalizedRequest.resolvedCharacters
    .map((c) => `- ${c.name} [CORE]: ${JSON.stringify(c.essence)}`)
    .join("\n")

  const supportingCharacters = (outline as Record<string, unknown>).supportingCharacters as Array<Record<string, string>> | undefined
  const supportingLines = supportingCharacters?.length
    ? "\n\nSupporting Characters (story-only, subordinate to core characters):\n" +
      supportingCharacters.map((sc) =>
        `- ${sc.name} [SUPPORTING]: Role: ${sc.role}. ${sc.primary_trait}${sc.secondary_trait ? `, ${sc.secondary_trait}` : ""}. Emotional function: ${sc.emotional_function}. Appearance: ${sc.appearance}. Voice: ${sc.voice_tone}. Relationship: ${sc.relationship_to_core}.`
      ).join("\n")
    : ""

  const supportingGuidance = supportingCharacters?.length
    ? `\n\nIMPORTANT: Core characters must remain the emotional and narrative center. Supporting characters assist, reflect, or accompany — they must not overshadow the core characters. Keep supporting character screen time proportionate to their role.`
    : ""

  // Build continuity context for the story writer
  const continuityContext = buildContinuitySection(contextPack)

  const router = getAIRouter()
  const response = await router.call<StoryDraft>({
    capability: "generate:story-draft",
    systemPrompt: `You are a master children's story writer. Write a beautiful, age-appropriate bedtime story.
Age Band: ${normalizedRequest.ageBand}
Word Count: AIM FOR ${Math.round(normalizedRequest.targetWordCount * 1.2)} WORDS (minimum ${normalizedRequest.targetWordCount}, maximum ${Math.round(normalizedRequest.targetWordCount * 1.5)}). Do NOT write a shorter story than the minimum. Flesh out scenes, add sensory details, and let moments breathe. Short does not mean rushed.
Tone: ${normalizedRequest.toneSpec.intensity} intensity, ${normalizedRequest.toneSpec.vocabulary} vocabulary
The story must have a ${outline.endingType} ending.

Core Characters (reference only — do NOT describe every physical trait in the story):
${coreCharacterLines}${supportingLines}${supportingGuidance}
${continuityContext}

WRITING RULES:
- Do NOT recite character descriptions. Readers know what the characters look like.
- Only mention a physical detail when it's naturally relevant to the scene (e.g. "her curls bounced as she ran" not "she had curly red hair and green eyes and freckles").
- Write like the 5th book in a series, not the 1st. Trust the reader.
- Focus on story, dialogue, emotion, and sensory detail — not character introductions.

Return ONLY valid JSON with title and pages array.`,
    userPrompt: `Write the story based on this outline:\n${JSON.stringify(outline, null, 2)}`,
    responseSchema: StoryDraftSchema,
    temperature: 0.85,
    maxTokens: 6000,
  })

  ctx.storyDraft = response.output
  ctx.log.push({
    step: "generate-story-draft",
    status: "completed",
    durationMs: Date.now() - start,
    provider: response.provider,
    model: response.model,
    tokenUsage: response.usage,
  })

  return ctx
}

function buildContinuitySection(contextPack: ContextPack): string {
  const sections: string[] = []

  // Character memory context
  const charMemories = contextPack.characterMemories.filter(
    (cm) => Object.keys(cm.evolvingState).length > 0 || cm.recentEvents.length > 0
  )
  if (charMemories.length > 0) {
    sections.push("CHARACTER CONTINUITY (write characters consistently with their established state):")
    for (const cm of charMemories) {
      const parts = [`  ${cm.characterName}:`]
      if (Object.keys(cm.evolvingState).length > 0) {
        parts.push(`    Current state: ${JSON.stringify(cm.evolvingState)}`)
      }
      if (cm.recentEvents.length > 0) {
        parts.push(`    Recent: ${cm.recentEvents.slice(-3).map((e) => e.summary).join("; ")}`)
      }
      sections.push(parts.join("\n"))
    }
  }

  // Branch facts
  if (Object.keys(contextPack.branchFacts.facts).length > 0) {
    sections.push(`ESTABLISHED FACTS: ${JSON.stringify(contextPack.branchFacts.facts)}`)
  }

  // Recent stories
  const recentWithSummary = contextPack.recentStories.filter((s) => s.summary)
  if (recentWithSummary.length > 0) {
    sections.push("RECENT STORIES (maintain consistency):\n" +
      recentWithSummary.slice(0, 3).map((s) => `  - "${s.title}": ${s.summary.slice(0, 200)}`).join("\n"))
  }

  // Parent story for continuations
  if (contextPack.parentStory) {
    const parentText = contextPack.parentStory.content.map((p) => p.text).join("\n\n")
    const excerpt = parentText.length > 3000
      ? parentText.slice(0, 1500) + "\n[...]\n" + parentText.slice(-1500)
      : parentText
    sections.push(`CONTINUATION — Previous story "${contextPack.parentStory.title}":\n${excerpt}\n\nPick up where this story left off. Do NOT re-introduce characters.`)
  }

  return sections.length > 0 ? "\n" + sections.join("\n\n") : ""
}
