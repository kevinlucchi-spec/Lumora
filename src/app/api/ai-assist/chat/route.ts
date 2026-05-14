import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getAIRouter } from "@/lib/providers/ai"
import { prisma } from "@/lib/prisma"
import { getPageAgent } from "@/lib/winston/page-agents"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { message, pathname, history, confirmAction } = body

  // If confirming an action, execute it
  if (confirmAction) {
    return executeAction(confirmAction, session.user.id)
  }

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message required" }, { status: 400 })
  }

  const agent = getPageAgent(pathname ?? "/dashboard")

  // Fetch live data for context
  const liveContext = await getLiveContext(session.user.id, pathname ?? "/dashboard")

  const historyLines = (history ?? [])
    .map((m: { role: string; text: string }) => `${m.role === "user" ? "User" : "Winston"}: ${m.text}`)
    .join("\n")

  try {
    const router = getAIRouter()
    const response = await router.call({
      capability: "generate:repair-plan",
      systemPrompt: `You are Winston Wigglesworth, a friendly bookworm caterpillar assistant built into "Lumora" — a bedtime story creation app. You wear round glasses and a cozy brown cardigan.

PERSONALITY: Warm, concise (2-4 sentences), helpful. Occasional gentle bookworm humor.

CURRENT PAGE: ${agent.pageName}
${agent.knowledge}

LIVE DATA FROM THIS PAGE:
${liveContext}

YOU CAN PERFORM ACTIONS. When the user asks you to do something (delete, create, generate, etc.), respond with your message AND include an action block. Format:

If you need to perform an action, include this EXACT format at the END of your response:
[ACTION:action_id:param1=value1:param2=value2]

Available actions (use on ANY page):

DESTRUCTIVE (ALWAYS confirm first):
- delete-character — Archive a character. Params: characterId
- delete-series — Archive a series. Params: seriesId
- delete-story — Archive a story. Params: storyId
- delete-prompt-seed — Archive a prompt seed. Params: promptSeedId
- delete-world — Archive a world. Params: worldId
- delete-art-style — Archive an art style. Params: artStyleId

CREATIVE (execute immediately):
- create-character — Create a new character. Params: name, description, personality, appearance, voiceTone, age
- edit-character — Update a character. Params: characterId, name, description, personality, appearance, voiceTone, age (only include fields to change)
- edit-story — Update a story title. Params: storyId, title
- create-series — Create a new series. Params: name, description
- edit-series — Update a series. Params: seriesId, name, description (only include fields to change)
- link-character — Link a character to a series. Params: seriesId, characterId
- unlink-character — Remove character from series. Params: seriesId, characterId
- generate-portrait — Generate portrait for a character. Params: characterId, artStyle (optional)
- edit-portrait — Edit a character's portrait with AI. Params: characterId, editInstruction (e.g. "add a wizard hat", "make the eyes greener")
- remove-portrait — Remove a character's portrait. Params: characterId
- generate-story — Start story generation. Params: seriesId, characterIds (comma-separated), mode (CALM_BEDTIME/COZY_ADVENTURE/MORAL_LESSON/DREAMLIKE/SIBLING_FAMILY), ageBand (TODDLER/EARLY/MIDDLE/TWEEN/PRETEEN), length (quick/short/medium/long), generateImages (true/false). I will auto-lookup branchId and volumeId from the series.
- create-world — Create a world. Params: name, description, rules, toneGuide
- create-art-style — Create art style. Params: name, styleKeywords (comma-separated), medium
- create-prompt-seed — Create a prompt seed. Params: name, prompt, themes (comma-separated)
- link-world — Link world to series. Params: seriesId, worldId
- link-art-style — Link art style to series. Params: seriesId, artStyleId

NAVIGATION:
- navigate — Send user to a page. Params: path

RULES:
1. For DESTRUCTIVE actions (delete), ALWAYS ask for confirmation first. Say "I'll delete [name] — are you sure?" and include the action block. The frontend will show a confirm button.
2. For non-destructive actions, you can include the action block immediately.
3. Use the LIVE DATA to look up IDs. If user says "delete Clover", find Clover's ID in the live data.
4. If you can't find what the user mentions in the live data, say so honestly.
5. Give accurate directions about WHERE things are on the page — use the LAYOUT info from your knowledge.
6. NEVER use emojis.`,
      userPrompt: `${historyLines ? `Previous conversation:\n${historyLines}\n\n` : ""}User: ${message}`,
      temperature: 0.7,
    })

    // Parse response for action blocks
    const rawReply = response.rawText.trim()
    const actionMatch = rawReply.match(/\[ACTION:([^\]]+)\]/)
    let reply = rawReply.replace(/\[ACTION:[^\]]*\]/g, "").trim()
    let action = null

    if (actionMatch) {
      const parts = actionMatch[1].split(":")
      const actionId = parts[0]
      const params: Record<string, string> = {}
      for (let i = 1; i < parts.length; i++) {
        const [k, v] = parts[i].split("=")
        if (k && v) params[k] = v
      }
      action = { id: actionId, params }
    }

    return NextResponse.json({ reply, action })
  } catch {
    return NextResponse.json({ reply: "Oh dear, my glasses fogged up! Could you try that again?" })
  }
}

async function getLiveContext(userId: string, pathname: string): Promise<string> {
  const parts: string[] = []

  try {
    // Always load full library overview so Winston can search/answer questions about any content
    const [allChars, allSeries, allWorlds, allArtStyles, allPromptSeeds] = await Promise.all([
      prisma.characterTemplate.findMany({
        where: { userId, archivedAt: null },
        select: { id: true, name: true, description: true, portraitAssetId: true },
        orderBy: { name: "asc" },
      }),
      prisma.series.findMany({
        where: { userId, archivedAt: null },
        select: { id: true, name: true, description: true },
        orderBy: { name: "asc" },
      }),
      prisma.worldTemplate.findMany({
        where: { userId, archivedAt: null },
        select: { id: true, name: true, description: true },
        orderBy: { name: "asc" },
      }),
      prisma.artStylePreset.findMany({
        where: { userId, archivedAt: null },
        select: { id: true, name: true, medium: true },
        orderBy: { name: "asc" },
      }),
      prisma.storyPromptSeed.findMany({
        where: { userId, archivedAt: null },
        select: { id: true, name: true, prompt: true },
        orderBy: { name: "asc" },
      }),
    ])

    parts.push("ALL CHARACTERS: " + (allChars.length === 0 ? "(none)" :
      allChars.map((c) => `${c.name} (id: ${c.id}${c.portraitAssetId ? ", has portrait" : ""}${c.description ? `, "${c.description}"` : ""})`).join("; ")))

    parts.push("ALL SERIES: " + (allSeries.length === 0 ? "(none)" :
      allSeries.map((s) => `${s.name} (id: ${s.id}${s.description ? `, "${s.description}"` : ""})`).join("; ")))

    if (allWorlds.length > 0)
      parts.push("ALL WORLDS: " + allWorlds.map((w) => `${w.name} (id: ${w.id})`).join("; "))

    if (allArtStyles.length > 0)
      parts.push("ALL ART STYLES: " + allArtStyles.map((a) => `${a.name}${a.medium ? ` (${a.medium})` : ""} (id: ${a.id})`).join("; "))

    if (allPromptSeeds.length > 0)
      parts.push("ALL PROMPT SEEDS: " + allPromptSeeds.map((p) => `${p.name} (id: ${p.id})`).join("; "))

    // Load all stories across all series for search
    const allStories = await prisma.story.findMany({
      where: { archivedAt: null, volume: { branch: { series: { userId, archivedAt: null } } } },
      select: {
        id: true, title: true, mode: true, ageBand: true, wordCount: true,
        content: true,
        volume: { select: { branch: { select: { seriesId: true, series: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    if (allStories.length > 0) {
      parts.push("ALL STORIES:\n" + allStories.map((s) => {
        const pages = s.content as Array<{ text: string }>
        const preview = pages?.[0]?.text?.slice(0, 100) ?? ""
        return `- "${s.title}" in series "${s.volume.branch.series.name}" (id: ${s.id}, seriesId: ${s.volume.branch.seriesId}, ${s.mode}, ${s.ageBand}, ${s.wordCount ?? "?"} words) — ${preview}...`
      }).join("\n"))
    }

    // Page-specific extra context
    const seriesMatch = pathname.match(/^\/series\/([^/]+)$/)
    if (seriesMatch) {
      const seriesId = seriesMatch[1]
      const linked = await prisma.characterInstance.findMany({
        where: { seriesId, archivedAt: null },
        include: { characterTemplate: { select: { id: true, name: true } } },
      })
      parts.push("LINKED TO THIS SERIES — Characters: " + (linked.length === 0 ? "(none)" :
        linked.map((ci) => `${ci.characterTemplate.name} (templateId: ${ci.characterTemplate.id})`).join(", ")))
    }

    const storyMatch = pathname.match(/^\/series\/[^/]+\/stories\/([^/]+)$/)
    if (storyMatch) {
      const story = await prisma.story.findFirst({
        where: { id: storyMatch[1] },
        select: { id: true, title: true, mode: true, ageBand: true, wordCount: true },
      })
      if (story) parts.push(`CURRENT STORY: "${story.title}" (${story.mode}, ${story.ageBand}, ${story.wordCount} words)`)
    }
  } catch {
    // Non-critical
  }

  return parts.length > 0 ? parts.join("\n\n") : "No live data available."
}

async function executeAction(action: { id: string; params: Record<string, string> }, userId: string) {
  try {
    switch (action.id) {
      case "delete-character": {
        const { characterId } = action.params
        if (!characterId) return NextResponse.json({ reply: "I couldn't find the character ID." })
        await prisma.characterTemplate.updateMany({
          where: { id: characterId, userId, archivedAt: null },
          data: { archivedAt: new Date() },
        })
        return NextResponse.json({ reply: "Done — character has been removed from your library.", actionCompleted: true, refresh: true })
      }

      case "delete-series": {
        const { seriesId } = action.params
        if (!seriesId) return NextResponse.json({ reply: "I couldn't find the series ID." })
        await prisma.series.updateMany({
          where: { id: seriesId, userId, archivedAt: null },
          data: { archivedAt: new Date() },
        })
        return NextResponse.json({ reply: "Done — series has been archived.", actionCompleted: true, refresh: true })
      }

      case "delete-story": {
        const { storyId } = action.params
        if (!storyId) return NextResponse.json({ reply: "I couldn't find the story ID." })
        await prisma.story.updateMany({
          where: { id: storyId, archivedAt: null },
          data: { archivedAt: new Date() },
        })
        return NextResponse.json({ reply: "Done — story has been removed.", actionCompleted: true, refresh: true })
      }

      case "create-character": {
        const { name, description, personality, appearance, voiceTone, age } = action.params
        if (!name) return NextResponse.json({ reply: "I need at least a name to create a character." })
        const char = await prisma.characterTemplate.create({
          data: {
            userId,
            name,
            description: description || null,
            essence: { personality: personality || "", appearance: appearance || "", voiceTone: voiceTone || "", age: age || "" },
          },
        })
        return NextResponse.json({
          reply: `Created "${name}" — you can find them in your character library now.`,
          actionCompleted: true,
          navigate: `/library/characters/${char.id}`,
        })
      }

      case "create-series": {
        const { name, description } = action.params
        if (!name) return NextResponse.json({ reply: "I need a name for the series." })
        const series = await prisma.series.create({
          data: {
            userId,
            name,
            description: description || null,
            branches: {
              create: {
                name: "Main",
                isCanon: true,
                volumes: { create: { name: "Volume 1", order: 1 } },
              },
            },
          },
        })
        return NextResponse.json({
          reply: `Created series "${name}" with a Main branch. You can start linking characters and generating stories.`,
          actionCompleted: true,
          navigate: `/series/${series.id}`,
        })
      }

      case "link-character": {
        const { seriesId, characterId } = action.params
        if (!seriesId || !characterId) return NextResponse.json({ reply: "I need both the series and character to link them." })
        // Check if already linked
        const existing = await prisma.characterInstance.findFirst({
          where: { seriesId, characterTemplateId: characterId },
        })
        if (existing) return NextResponse.json({ reply: "That character is already linked to this series.", actionCompleted: true })
        await prisma.characterInstance.create({
          data: {
            seriesId,
            characterTemplateId: characterId,
            memoryState: {},
          },
        })
        // Also create character memory
        const instance = await prisma.characterInstance.findFirst({
          where: { seriesId, characterTemplateId: characterId },
        })
        if (instance) {
          await prisma.characterMemory.create({
            data: { characterInstanceId: instance.id, stableFacts: {}, evolvingState: {}, eventLog: [] },
          }).catch(() => { /* already exists */ })
        }
        return NextResponse.json({ reply: "Character linked to the series.", actionCompleted: true, refresh: true })
      }

      case "edit-character": {
        const { characterId, ...fields } = action.params
        if (!characterId) return NextResponse.json({ reply: "I need to know which character to edit." })
        const updateData: Record<string, unknown> = {}
        if (fields.name) updateData.name = fields.name
        if (fields.description) updateData.description = fields.description
        // Build essence update
        const existingChar = await prisma.characterTemplate.findUnique({ where: { id: characterId }, select: { essence: true } })
        const currentEssence = (existingChar?.essence ?? {}) as Record<string, string>
        const newEssence = { ...currentEssence }
        if (fields.personality) newEssence.personality = fields.personality
        if (fields.appearance) newEssence.appearance = fields.appearance
        if (fields.voiceTone) newEssence.voiceTone = fields.voiceTone
        if (fields.age) newEssence.age = fields.age
        if (Object.keys(fields).some(k => ["personality", "appearance", "voiceTone", "age"].includes(k))) {
          updateData.essence = newEssence
        }
        await prisma.characterTemplate.updateMany({ where: { id: characterId, userId }, data: updateData })
        return NextResponse.json({ reply: "Character updated.", actionCompleted: true, refresh: true })
      }

      case "edit-series": {
        const { seriesId, name, description } = action.params
        if (!seriesId) return NextResponse.json({ reply: "I need the series ID." })
        const data: Record<string, string> = {}
        if (name) data.name = name
        if (description) data.description = description
        await prisma.series.updateMany({ where: { id: seriesId, userId }, data })
        return NextResponse.json({ reply: "Series updated.", actionCompleted: true, refresh: true })
      }

      case "unlink-character": {
        const { seriesId, characterId } = action.params
        if (!seriesId || !characterId) return NextResponse.json({ reply: "I need both the series and character." })
        await prisma.characterInstance.deleteMany({ where: { seriesId, characterTemplateId: characterId } })
        return NextResponse.json({ reply: "Character removed from series.", actionCompleted: true, refresh: true })
      }

      case "generate-portrait": {
        const { characterId, artStyle } = action.params
        if (!characterId) return NextResponse.json({ reply: "I need to know which character to generate a portrait for." })
        const body: Record<string, string> = {}
        if (artStyle) body.artStyle = artStyle
        const res = await fetch(`${process.env.NEXTAUTH_URL ?? "http://localhost:3006"}/api/library/characters/${characterId}/portrait`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          return NextResponse.json({ reply: `Portrait generation failed: ${err.error ?? "unknown error"}` })
        }
        return NextResponse.json({ reply: "Portrait generated! Refresh the page to see it.", actionCompleted: true, refresh: true })
      }

      case "edit-portrait": {
        const { characterId, editInstruction } = action.params
        if (!characterId) return NextResponse.json({ reply: "I need to know which character's portrait to edit." })
        if (!editInstruction) return NextResponse.json({ reply: "Tell me what to change — e.g. 'add a wizard hat' or 'make the background blue'." })
        const res = await fetch(`${process.env.NEXTAUTH_URL ?? "http://localhost:3006"}/api/library/characters/${characterId}/portrait/edit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editInstruction }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          return NextResponse.json({ reply: `Portrait edit failed: ${err.error ?? "unknown error"}` })
        }
        return NextResponse.json({ reply: "Portrait updated! Refresh to see the changes.", actionCompleted: true, refresh: true })
      }

      case "remove-portrait": {
        const { characterId } = action.params
        if (!characterId) return NextResponse.json({ reply: "I need to know which character." })
        await prisma.characterTemplate.updateMany({
          where: { id: characterId, userId },
          data: { portraitAssetId: null },
        })
        return NextResponse.json({ reply: "Portrait removed.", actionCompleted: true, refresh: true })
      }

      case "generate-story": {
        const p = action.params
        if (!p.seriesId) return NextResponse.json({ reply: "I need to know which series to generate a story for." })
        // Auto-lookup branch and volume from series
        const branch = await prisma.branch.findFirst({ where: { seriesId: p.seriesId, isCanon: true }, select: { id: true } })
        if (!branch) return NextResponse.json({ reply: "I couldn't find a branch for this series." })
        const volume = await prisma.volume.findFirst({ where: { branchId: branch.id }, orderBy: { order: "asc" }, select: { id: true } })
        if (!volume) return NextResponse.json({ reply: "I couldn't find a volume for this series." })
        // Auto-lookup character IDs if not provided
        let charIds = p.characterIds ? p.characterIds.split(",").filter(Boolean) : []
        if (charIds.length === 0) {
          const linked = await prisma.characterInstance.findMany({ where: { seriesId: p.seriesId, archivedAt: null }, select: { characterTemplateId: true } })
          charIds = linked.map((ci) => ci.characterTemplateId)
        }
        const { enqueueStoryGeneration } = await import("@/lib/services/generation.service")
        const { StoryGenerationRequestSchema } = await import("@/lib/schemas/request")
        const raw = {
          seriesId: p.seriesId,
          branchId: branch.id,
          volumeId: volume.id,
          characterIds: charIds,
          mode: p.mode || "CALM_BEDTIME",
          ageBand: p.ageBand || "EARLY",
          length: p.length || "short",
          generateImages: p.generateImages === "true",
          storyType: "new",
          supportingCharacterMode: "auto",
          storyIdeaMode: "auto",
          worldMode: "auto",
          artStyleMode: "auto",
        }
        const parsed = StoryGenerationRequestSchema.safeParse(raw)
        if (!parsed.success) return NextResponse.json({ reply: "I couldn't set up the story request. Try generating from the compose page." })
        await enqueueStoryGeneration(userId, parsed.data)
        return NextResponse.json({ reply: "Story generation started! Head to the series to watch the progress.", actionCompleted: true, navigate: `/series/${p.seriesId}` })
      }

      case "create-world": {
        const { name, description, rules, toneGuide } = action.params
        if (!name) return NextResponse.json({ reply: "I need a name for the world." })
        const world = await prisma.worldTemplate.create({
          data: { userId, name, description: description || null, rules: rules ? { description: rules } : {}, toneGuide: toneGuide ? { description: toneGuide } : {} },
        })
        return NextResponse.json({ reply: `World "${name}" created.`, actionCompleted: true, refresh: true, worldId: world.id })
      }

      case "create-art-style": {
        const { name, styleKeywords, medium } = action.params
        if (!name) return NextResponse.json({ reply: "I need a name for the art style." })
        await prisma.artStylePreset.create({
          data: { userId, name, styleKeywords: styleKeywords ? styleKeywords.split(",").map((s: string) => s.trim()) : [], medium: medium || null, negativeTerms: [] },
        })
        return NextResponse.json({ reply: `Art style "${name}" created.`, actionCompleted: true, refresh: true })
      }

      case "link-world": {
        const { seriesId, worldId } = action.params
        if (!seriesId || !worldId) return NextResponse.json({ reply: "I need both the series and world." })
        await prisma.seriesWorldLink.create({ data: { seriesId, worldTemplateId: worldId } }).catch(() => {})
        return NextResponse.json({ reply: "World linked to series.", actionCompleted: true, refresh: true })
      }

      case "link-art-style": {
        const { seriesId, artStyleId } = action.params
        if (!seriesId || !artStyleId) return NextResponse.json({ reply: "I need both the series and art style." })
        await prisma.seriesArtStyleLink.create({ data: { seriesId, artStylePresetId: artStyleId } }).catch(() => {})
        return NextResponse.json({ reply: "Art style linked to series.", actionCompleted: true, refresh: true })
      }

      case "edit-story": {
        const { storyId, title } = action.params
        if (!storyId || !title) return NextResponse.json({ reply: "I need a story ID and a new title." })
        await prisma.story.updateMany({
          where: { id: storyId, archivedAt: null },
          data: { title },
        })
        return NextResponse.json({ reply: "Story title updated.", actionCompleted: true, refresh: true })
      }

      case "create-prompt-seed": {
        const { name, prompt, themes } = action.params
        if (!name || !prompt) return NextResponse.json({ reply: "I need at least a name and prompt to create a prompt seed." })
        await prisma.storyPromptSeed.create({
          data: {
            userId,
            name,
            prompt,
            themes: themes ? themes.split(",").map((t: string) => t.trim()) : [],
            suggestedModes: [],
          },
        })
        return NextResponse.json({ reply: `Prompt seed "${name}" created.`, actionCompleted: true, refresh: true })
      }

      case "delete-prompt-seed": {
        const { promptSeedId } = action.params
        if (!promptSeedId) return NextResponse.json({ reply: "I couldn't find the prompt seed ID." })
        await prisma.storyPromptSeed.updateMany({
          where: { id: promptSeedId, userId, archivedAt: null },
          data: { archivedAt: new Date() },
        })
        return NextResponse.json({ reply: "Done — prompt seed has been archived.", actionCompleted: true, refresh: true })
      }

      case "delete-world": {
        const { worldId } = action.params
        if (!worldId) return NextResponse.json({ reply: "I couldn't find the world ID." })
        await prisma.worldTemplate.updateMany({
          where: { id: worldId, userId, archivedAt: null },
          data: { archivedAt: new Date() },
        })
        return NextResponse.json({ reply: "Done — world has been archived.", actionCompleted: true, refresh: true })
      }

      case "delete-art-style": {
        const { artStyleId } = action.params
        if (!artStyleId) return NextResponse.json({ reply: "I couldn't find the art style ID." })
        await prisma.artStylePreset.updateMany({
          where: { id: artStyleId, userId, archivedAt: null },
          data: { archivedAt: new Date() },
        })
        return NextResponse.json({ reply: "Done — art style has been archived.", actionCompleted: true, refresh: true })
      }

      case "navigate": {
        const { path } = action.params
        return NextResponse.json({ reply: "Taking you there now.", navigate: path })
      }

      default:
        return NextResponse.json({ reply: "I don't know how to do that yet." })
    }
  } catch (err) {
    return NextResponse.json({ reply: `Something went wrong: ${(err as Error).message}` })
  }
}
