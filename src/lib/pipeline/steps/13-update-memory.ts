import { getAIRouter } from "@/lib/providers/ai"
import { updateCharacterMemory } from "@/lib/memory/character-memory"
import { updateBranchMemory } from "@/lib/memory/branch-memory"
import type { PipelineContext } from "../types"

interface ExtractedMemory {
  characterUpdates: Array<{
    characterName: string
    stateChanges: Record<string, unknown>
    eventSummary: string
  }>
  branchFacts: Record<string, unknown>
  branchEventSummary: string
}

export async function updateMemoryState(ctx: PipelineContext): Promise<PipelineContext> {
  const start = Date.now()
  const { normalizedRequest, storyDraft, contextPack, runId } = ctx
  if (!normalizedRequest || !storyDraft) {
    ctx.log.push({ step: "update-memory", status: "skipped" })
    return ctx
  }

  try {
    // Use AI to extract structured memory updates from the story
    const extracted = await extractMemoryUpdates(ctx)

    // Update character memories with extracted state changes
    for (const character of normalizedRequest.resolvedCharacters) {
      const charUpdate = extracted?.characterUpdates.find(
        (u) => u.characterName.toLowerCase() === character.name.toLowerCase()
      )

      await updateCharacterMemory(character.instanceId, {
        evolvingState: charUpdate?.stateChanges,
        newEvent: {
          storyId: runId,
          summary: charUpdate?.eventSummary ?? `Appeared in "${storyDraft.title}"`,
        },
      })
    }

    // Update branch memory with extracted facts
    await updateBranchMemory(normalizedRequest.branchId, {
      newFacts: extracted?.branchFacts,
      newEvent: {
        storyId: runId,
        summary: extracted?.branchEventSummary ?? `Story "${storyDraft.title}" was added`,
      },
    })

    ctx.log.push({ step: "update-memory", status: "completed", durationMs: Date.now() - start })
  } catch (err) {
    ctx.errors.push({ step: "update-memory", critical: false, message: (err as Error).message })
    ctx.log.push({ step: "update-memory", status: "failed" })
  }

  return ctx
}

async function extractMemoryUpdates(ctx: PipelineContext): Promise<ExtractedMemory | null> {
  const { normalizedRequest, storyDraft, contextPack } = ctx
  if (!normalizedRequest || !storyDraft) return null

  const characterNames = normalizedRequest.resolvedCharacters.map((c) => c.name)
  const storyText = storyDraft.pages.map((p) => p.text).join("\n\n")

  // Build current state context so the AI knows what changed
  const currentStates = normalizedRequest.resolvedCharacters.map((c) => {
    const mem = contextPack?.characterMemories.find(
      (cm) => cm.characterInstanceId === c.instanceId
    )
    return `${c.name}: ${mem ? JSON.stringify(mem.evolvingState) : "{}"}`
  }).join("\n")

  try {
    const router = getAIRouter()
    const response = await router.call({
      capability: "generate:repair-plan", // reuse haiku for fast extraction
      systemPrompt: `You extract structured story memory updates from a children's story. Analyze the story and identify what changed for each character and the story world.

Return ONLY valid JSON (no markdown fences):
{
  "characterUpdates": [
    {
      "characterName": "Name",
      "stateChanges": { "mood": "...", "location": "...", "relationships": {}, "learned": "...", "possessions": [] },
      "eventSummary": "One sentence: what happened to this character in the story"
    }
  ],
  "branchFacts": { "key_plot_point": "value", "location_established": "value" },
  "branchEventSummary": "One sentence: what happened in this story that matters for future stories"
}

Only include state that CHANGED or was ESTABLISHED. Omit unchanged fields. Keep summaries concise.`,
      userPrompt: `Characters to track: ${characterNames.join(", ")}
Current character states:
${currentStates}

Story "${storyDraft.title}":
${storyText}`,
      temperature: 0.3,
    })

    // Extract JSON from potential markdown fences
    const raw = response.rawText.trim()
    const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    const jsonStr = fenceMatch ? fenceMatch[1].trim() : raw
    // Find the JSON object if there's surrounding text
    const start = jsonStr.indexOf("{")
    const end = jsonStr.lastIndexOf("}")
    const cleaned = start >= 0 && end > start ? jsonStr.slice(start, end + 1) : jsonStr

    return JSON.parse(cleaned) as ExtractedMemory
  } catch (err) {
    console.error("[memory-extraction] Failed to extract memory updates:", (err as Error).message)
    return null
  }
}
