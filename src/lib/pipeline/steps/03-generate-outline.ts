import { getAIRouter } from "@/lib/providers/ai"
import { StoryOutlineSchema } from "@/lib/schemas/outline"
import type { PipelineContext, NormalizedRequest } from "../types"
import type { ContextPack } from "@/lib/memory/types"

export async function generateOutline(ctx: PipelineContext): Promise<PipelineContext> {
  const start = Date.now()
  const { normalizedRequest, contextPack } = ctx
  if (!normalizedRequest || !contextPack) throw new Error("Context missing for outline generation")

  const router = getAIRouter()
  const response = await router.call({
    capability: "generate:outline",
    systemPrompt: buildOutlineSystemPrompt(contextPack, normalizedRequest),
    userPrompt: buildOutlineUserPrompt(normalizedRequest),
    responseSchema: StoryOutlineSchema,
    temperature: 0.8,
  })

  ctx.outline = response.output as never
  ctx.log.push({
    step: "generate-outline",
    status: "completed",
    durationMs: Date.now() - start,
    provider: response.provider,
    model: response.model,
    tokenUsage: response.usage,
  })

  return ctx
}

// ────────────────────────────────────────────────────
// System prompt
// ────────────────────────────────────────────────────

function buildOutlineSystemPrompt(contextPack: ContextPack, req: NormalizedRequest): string {
  const supportingMode = req.supportingCharacterMode ?? "auto"

  // World context section
  let worldSection: string
  if (req.resolvedWorld) {
    worldSection = `World: "${req.resolvedWorld.name}" — Canon: ${JSON.stringify(contextPack.worldCanon.rules)}`
  } else if (req.resolvedCustomWorld) {
    worldSection = `World (user-described): ${req.resolvedCustomWorld}\nBuild the world context from this description. Keep it coherent and age-appropriate.`
  } else {
    worldSection = `World: AUTO — Infer a coherent, appropriate world setting from the characters, story mode, and premise. The world should feel deliberate, not generic.`
  }

  // Art style section
  let artSection: string
  if (req.resolvedArtStyle) {
    artSection = `Art Style: ${req.resolvedArtStyle.styleKeywords.join(", ")}${req.resolvedArtStyle.medium ? ` (${req.resolvedArtStyle.medium})` : ""}`
  } else if (req.resolvedCustomArtStyle) {
    artSection = `Art Style (user-described): ${req.resolvedCustomArtStyle}`
  } else {
    artSection = `Art Style: AUTO — Choose a safe, coherent visual style appropriate for the tone and audience.`
  }

  return `You are a master children's story architect. Create engaging, age-appropriate bedtime story outlines.

${worldSection}
${artSection}
Tone Guide: Age band ${contextPack.toneGuide.ageBand}, Mode: ${contextPack.toneGuide.mode}, Intensity: ${contextPack.toneGuide.intensity}

${buildCharacterMemoryContext(contextPack)}
${buildBranchContext(contextPack)}
${buildRecentStoriesContext(contextPack)}
${buildSupportingCharacterRules(supportingMode, req)}

${buildContinuationContext(contextPack, req)}

INPUT RESOLUTION:
- Fixed inputs (user custom text or library selections) are constraints you MUST respect.
- Auto inputs are your creative freedom — make strong, deliberate choices. Auto is not "missing input."
- If ALL inputs are auto, you must still generate a complete, high-quality, specific story setup.

Return ONLY valid JSON (no markdown fences) with this EXACT structure:
{
  "title": "Story title",
  "logline": "One-sentence summary",
  "sections": [
    { "title": "Section title", "summary": "What happens", "charactersInvolved": ["Name1", "Name2"] }
  ],
  "characterArcs": [
    { "characterId": "template-id-or-name", "characterName": "Name", "arc": "How they change" }
  ],
  "supportingCharacters": [
    { "name": "", "role": "", "relationship_to_core": "", "primary_trait": "", "secondary_trait": "", "emotional_function": "", "appearance": "", "voice_tone": "", "story_only": true }
  ],
  "theme": "Central theme",
  "moral": "Lesson if applicable",
  "endingType": "reassuring"
}

RULES:
- "sections" must be an array with at least 2 sections
- "characterArcs" must be an array with at least 1 arc
- "endingType" must be exactly one of: "reassuring", "wonder", "lesson", "open"
- "supportingCharacters" should be an empty array if none are needed
- Do NOT wrap the JSON in markdown code fences`
}

// ────────────────────────────────────────────────────
// User prompt
// ────────────────────────────────────────────────────

function buildOutlineUserPrompt(req: NormalizedRequest): string {
  // Story idea section
  let storyIdeaLine: string
  if (req.resolvedPrompt) {
    storyIdeaLine = `Story Idea: ${req.resolvedPrompt}`
  } else {
    storyIdeaLine = `Story Idea: AUTO — Generate an engaging, original story premise based on the characters, world, mode, and age band. Make it feel intentional and specific, not generic.`
  }

  // Characters
  const charLines = req.resolvedCharacters.length > 0
    ? req.resolvedCharacters.map((c) => `${c.name} (${JSON.stringify(c.essence)})`).join(", ")
    : "No specific characters selected — AI should create appropriate main character(s) for the story."

  const parts = [
    `Create a story outline with these parameters:`,
    storyIdeaLine,
    `Mode: ${req.mode}`,
    `Age Band: ${req.ageBand}`,
    `Length Tier: ${req.length}`,
    `Target Word Count: ${req.targetWordCount}`,
    getLengthTierGuidance(req.length),
    `Characters: ${charLines}`,
    `Supporting Character Mode: ${req.supportingCharacterMode ?? "auto"}`,
  ]

  if (req.supportingCharacterDescription) {
    parts.push(`Supporting Character Guidance: "${req.supportingCharacterDescription}" — Use this as a constraint when creating the supporting character. Complete missing details (name, appearance, traits) yourself.`)
  }

  if (req.customToneOverride) {
    parts.push(`Tone Override: ${req.customToneOverride}`)
  }

  return parts.join("\n")
}

function buildCharacterMemoryContext(contextPack: ContextPack): string {
  if (contextPack.characterMemories.length === 0) return ""

  const lines = contextPack.characterMemories.map((cm) => {
    const parts = [`CHARACTER MEMORY — ${cm.characterName}:`]
    if (Object.keys(cm.stableFacts).length > 0) {
      parts.push(`  Stable Facts: ${JSON.stringify(cm.stableFacts)}`)
    }
    if (Object.keys(cm.evolvingState).length > 0) {
      parts.push(`  Current State: ${JSON.stringify(cm.evolvingState)}`)
    }
    if (cm.recentEvents.length > 0) {
      parts.push(`  Recent History: ${cm.recentEvents.map((e) => e.summary).join("; ")}`)
    }
    return parts.join("\n")
  })

  return `CHARACTER CONTINUITY CONTEXT (for your reference — do NOT recite all these details in the story):
${lines.join("\n\n")}

IMPORTANT: These details are for continuity accuracy, not narration. Do NOT describe the character's full appearance in every story. Mention a physical detail only when it's naturally relevant to a scene (e.g. eyes catching light, fur getting wet). Readers already know what the character looks like from earlier stories. Write like a real series — trust the reader's memory.`
}

function buildBranchContext(contextPack: ContextPack): string {
  const { branchFacts } = contextPack
  if (Object.keys(branchFacts.facts).length === 0 && branchFacts.recentEvents.length === 0) return ""

  const parts: string[] = ["BRANCH CONTINUITY (established world/plot state for this story branch):"]
  if (Object.keys(branchFacts.facts).length > 0) {
    parts.push(`  Established Facts: ${JSON.stringify(branchFacts.facts)}`)
  }
  if (branchFacts.recentEvents.length > 0) {
    parts.push(`  Recent Events: ${branchFacts.recentEvents.map((e) => e.summary).join("; ")}`)
  }
  return parts.join("\n")
}

function buildRecentStoriesContext(contextPack: ContextPack): string {
  const stories = contextPack.recentStories.filter((s) => s.summary)
  if (stories.length === 0) return ""

  return `RECENT STORIES IN THIS BRANCH (maintain consistency with these):
${stories.map((s) => `- "${s.title}" (${s.mode}): ${s.summary}`).join("\n")}`
}

function buildContinuationContext(contextPack: ContextPack, req: NormalizedRequest): string {
  if (req.storyType !== "continuation" || !contextPack.parentStory) return ""

  const parent = contextPack.parentStory
  const storyText = parent.content.map((p) => p.text).join("\n\n")
  // Include full story up to 5000 chars; summarize key points if longer
  const storyContext = storyText.length > 5000
    ? storyText.slice(0, 2500) + "\n\n[...middle section...]\n\n" + storyText.slice(-2500)
    : storyText

  return `CONTINUATION MODE — THIS IS A SEQUEL
You are writing the NEXT CHAPTER of an existing story. This is NOT a new standalone story.

PREVIOUS STORY: "${parent.title}"
---
${storyContext}
---

CONTINUATION RULES:
- This story MUST pick up where the previous story left off
- Maintain all character relationships, personality, and development from the previous story
- Reference events, locations, and emotional outcomes from the previous story naturally
- The world state must be consistent — do not contradict established facts
- Characters should show growth or continuity from where they were
- The tone should feel like "next chapter" not "new story"
- Do NOT re-introduce characters as if the reader hasn't met them
- You may advance time slightly (next day, next week) but maintain continuity`
}

function getLengthTierGuidance(length: string): string {
  switch (length) {
    case "quick": return "STORY STRUCTURE (Quick ~2-3 min): Very tight arc. Minimal characters. Fast emotional resolution. 1-2 key scenes. Do NOT stretch content — keep it naturally brief and complete."
    case "short": return "STORY STRUCTURE (Short ~5 min): Simple arc. Light character development. Small challenge leading to resolution. Do NOT pad content."
    case "medium": return "STORY STRUCTURE (Medium ~10 min): Full story arc. Moderate complexity. More interaction and dialogue. Natural pacing."
    case "long": return "STORY STRUCTURE (Long ~20 min): Multi-phase arc. Deeper emotional beats. Evolving situation. Rich but not overwritten."
    default: return ""
  }
}

// ────────────────────────────────────────────────────
// Supporting character rules
// ────────────────────────────────────────────────────

function buildSupportingCharacterRules(mode: string, req: NormalizedRequest): string {
  if (mode === "none") {
    return `SUPPORTING CHARACTERS: NONE
Do NOT invent any meaningful supporting characters.
Background entities may exist only in a non-character way if unavoidable.
Keep the story tightly focused on the selected characters.
Return an empty "supportingCharacters" array.`
  }

  const ageBandRules = getAgeBandRules(req.ageBand)
  const lengthRules = getLengthRules(req.length)
  const modeRules = getStoryModeRules(req.mode)
  const isContinuation = req.storyType === "continuation"
  const addOneConstraint = mode === "add_one"
    ? `You MUST generate exactly 1 supporting character. No more.${req.supportingCharacterDescription ? ` The user has provided guidance: "${req.supportingCharacterDescription}" — respect this description and complete missing details.` : ""}`
    : `You MAY generate 0 to 3 supporting characters. Prefer fewer. Absolute max: 3.`

  return `SUPPORTING CHARACTER GENERATION RULES

Selected characters are the required anchors. Supporting characters are optional additions that exist only in this story unless the user later saves them.

Mode: ${mode === "add_one" ? "add_one — generate exactly 1" : "auto — generate only if they improve the story"}
${addOneConstraint}

WHEN TO ADD: Only if a dialogue partner, helper, guide, gentle obstacle, or companion would improve clarity, warmth, emotional connection, pacing, dialogue, or story logic.

WHEN NOT TO ADD: If the story is intimate/sleepy/simple, the main character can carry it alone, the age band is very young and extra cast would confuse, the story is short and new characters would waste space, or the addition would dilute emotional focus.

${ageBandRules}
${lengthRules}
${modeRules}

${isContinuation ? "CONTINUATION: Be extremely conservative. Do not introduce new supporting characters unless clearly necessary. Preserve canon and relationship continuity." : ""}

HIERARCHY: Selected characters remain the emotional and narrative center. Supporting characters assist, reflect, challenge lightly, or accompany. They must not overshadow the main characters.

ROLE-FIRST: Think in this order: narrative role → relationship to core → emotional function → trait → name → appearance → voice.

VALID ROLES: friend, sibling, parent/caregiver, classmate, neighbor, guide, helper, soft authority figure, gentle rival, animal companion, magical companion, keeper of a place, messenger, one-scene obstacle.

EMOTIONAL FUNCTION (pick one per character): comfort, encouragement, curiosity, humor, perspective, contrast, lesson trigger, soft obstacle, companionship.

TRAITS: 1 defining trait, optionally 1 secondary. Examples: shy but kind, cheerful and chatty, cautious and thoughtful, sleepy and gentle. Do NOT create psychologically dense characters.

NAMES: Easy to read, age-appropriate, not too similar to existing characters. Simpler for younger audiences.

APPEARANCE: 1-3 memorable visual details. Do not over-design minor characters.

For each supporting character, include in the "supportingCharacters" array:
{
  "name": "",
  "role": "",
  "relationship_to_core": "",
  "primary_trait": "",
  "secondary_trait": "",
  "emotional_function": "",
  "appearance": "",
  "voice_tone": "",
  "story_only": true
}`
}

function getAgeBandRules(ageBand: string): string {
  switch (ageBand) {
    case "TODDLER": return "AGE BAND (Toddler 2-3): Prefer 0 or 1 supporting character. Extremely simple role, easy relationship, no complicated names or motivations."
    case "EARLY": return "AGE BAND (Early 4-6): Prefer 0 to 2 supporting characters. Keep roles obvious. Warmth and repetition matter more than complexity."
    case "MIDDLE": return "AGE BAND (Middle 7-9): 0 to 2 supporting characters usually works best. Can support more playful interaction and simple sub-conflict."
    case "TWEEN": return "AGE BAND (Tween 10-12): 0 to 3 supporting characters if needed. Keep cast controlled and readable."
    case "PRETEEN": return "AGE BAND (Preteen 12+): 0 to 3 supporting characters if needed. Still keep cast controlled."
    default: return ""
  }
}

function getLengthRules(length: string): string {
  switch (length) {
    case "short": return "LENGTH (Short): Prefer 0 or 1 supporting character. Keep introduction fast. Avoid multiple named additions."
    case "medium": return "LENGTH (Medium): 0 to 2 supporting characters."
    case "long": return "LENGTH (Long): 1 to 3 supporting characters only if each has a clear role."
    default: return ""
  }
}

function getStoryModeRules(mode: string): string {
  switch (mode) {
    case "CALM_BEDTIME": return "STORY MODE (Calm Bedtime): Add supporting characters sparingly. Prefer comforting roles: parent, sibling, friend, gentle guide, sleepy companion. Avoid conflict-heavy personalities."
    case "COZY_ADVENTURE": return "STORY MODE (Cozy Adventure): Supporting characters can assist with discovery, teamwork, or companionship. Keep stakes light."
    case "MORAL_LESSON": return "STORY MODE (Moral Lesson): A supporting character is often useful to reveal the lesson naturally. Avoid preachy mentor energy unless very soft."
    case "DREAMLIKE": return "STORY MODE (Dreamlike): Supporting characters may be whimsical, symbolic, or surreal. Must remain emotionally safe and understandable."
    case "SIBLING_FAMILY": return "STORY MODE (Sibling & Family): Supporting characters are often highly appropriate. Prefer family-linked roles."
    // CONTINUATION is now a storyType, not a mode — handled separately
    case "WHAT_IF_BRANCH": return "STORY MODE (What If): Supporting characters from the original may appear in altered roles."
    default: return ""
  }
}
