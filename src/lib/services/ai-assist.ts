// @ts-nocheck
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"

// ─── Field schemas per asset type (exact match to existing forms) ───

const CharacterFieldsSchema = z.object({
  name: z.string(),
  description: z.string(),
  age: z.string(),
  personality: z.string(),
  appearance: z.string(),
  voiceTone: z.string(),
  tags: z.string(), // comma-separated, matching form state
})

const WorldFieldsSchema = z.object({
  name: z.string(),
  description: z.string(),
  setting: z.string(),
  magicSystem: z.string(),
  tone: z.string(),
  tags: z.string(),
})

const ArtStyleFieldsSchema = z.object({
  name: z.string(),
  description: z.string(),
  keywords: z.string(), // comma-separated
  medium: z.string(),
  colorPalette: z.string(),
  negativeTerms: z.string(), // comma-separated
})

const PromptSeedFieldsSchema = z.object({
  name: z.string(),
  prompt: z.string(),
  themes: z.string(), // comma-separated
  suggestedModes: z.array(z.string()),
})

const FIELD_SCHEMAS: Record<string, z.ZodType> = {
  character: CharacterFieldsSchema,
  world: WorldFieldsSchema,
  artStyle: ArtStyleFieldsSchema,
  promptSeed: PromptSeedFieldsSchema,
}

export type AssetType = "character" | "world" | "artStyle" | "promptSeed"

// ─── System prompts per asset type ───

const SYSTEM_BASE = `You are a creative assistant for a children's bedtime story platform. You help users create reusable story assets.

CRITICAL RULES:
- All output must be child-safe, bedtime-friendly, warm, and imaginative
- No horror, violence, cruelty, disturbing imagery, or mature content
- If user requests something too dark, soften it into a bedtime-safe version
- Keep output concise and high-quality — no filler
- Return ONLY valid JSON matching the exact schema requested
- No markdown, no explanation, no extra text — pure JSON`

const ASSET_PROMPTS: Record<AssetType, string> = {
  character: `${SYSTEM_BASE}

You are generating a CHARACTER for a bedtime story library.

JSON schema (fill ALL fields):
{
  "name": "character name",
  "description": "one-line summary (max 100 chars)",
  "age": "age or life stage description",
  "personality": "personality traits, behaviors, emotional tendencies (2-3 sentences)",
  "appearance": "physical appearance, clothing, distinguishing features (2-3 sentences)",
  "voiceTone": "how they speak, verbal patterns, tone (1-2 sentences)",
  "tags": "comma-separated tags for categorization"
}

If the request is BROAD/REUSABLE: make the character flexible for many stories.
If SPECIFIC: include more contextual detail tied to the described scenario.`,

  world: `${SYSTEM_BASE}

You are generating a WORLD/SETTING for a bedtime story library.

JSON schema (fill ALL fields):
{
  "name": "world name",
  "description": "one-line summary of this world",
  "setting": "physical environment, atmosphere, key locations (2-3 sentences)",
  "magicSystem": "rules of magic or special mechanics in this world (1-2 sentences)",
  "tone": "emotional tone and atmosphere (1 sentence)",
  "tags": "comma-separated tags"
}

If BROAD: make it reusable across many stories.
If SPECIFIC: tie it to the described scenario.`,

  artStyle: `${SYSTEM_BASE}

You are generating an ART STYLE preset for story illustrations.

JSON schema (fill ALL fields):
{
  "name": "style name",
  "description": "brief description of the visual style",
  "keywords": "comma-separated style keywords for image generation (e.g. watercolor, soft edges, warm tones)",
  "medium": "primary art medium (e.g. watercolor, digital painting, pencil illustration)",
  "colorPalette": "color description (e.g. warm pastels, muted earth tones, vibrant primary colors)",
  "negativeTerms": "comma-separated terms to AVOID in images (e.g. photorealistic, scary, dark)"
}`,

  promptSeed: `${SYSTEM_BASE}

You are generating a PROMPT SEED (story starter/idea) for bedtime stories.

JSON schema (fill ALL fields):
{
  "name": "short title for this story idea",
  "prompt": "the story premise/idea, 2-4 sentences that set up an interesting bedtime story scenario",
  "themes": "comma-separated thematic tags (e.g. friendship, courage, kindness)",
  "suggestedModes": ["array of suggested story modes from: CALM_BEDTIME, COZY_ADVENTURE, MORAL_LESSON, DREAMLIKE, SIBLING_FAMILY"]
}

The prompt should be evocative and inspiring but leave room for the AI story writer to develop it.`,
}

// ─── Anthropic client ───

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (_client) return _client
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  return _client
}

// ─── Generate ───

export interface GenerateRequest {
  assetType: AssetType
  userPrompt: string
  currentValues?: Record<string, string | string[]>
}

export async function generateAssetDraft(req: GenerateRequest): Promise<Record<string, unknown>> {
  const client = getClient()

  let userMessage = req.userPrompt

  // If user has partially filled fields, include them as context
  if (req.currentValues) {
    const filled = Object.entries(req.currentValues)
      .filter(([, v]) => v && (typeof v === "string" ? v.trim() : v.length > 0))
    if (filled.length > 0) {
      userMessage += `\n\nThe user has already filled these fields (preserve or build on them):\n${filled.map(([k, v]) => `- ${k}: ${v}`).join("\n")}`
    }
  }

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    temperature: 0.8,
    system: ASSET_PROMPTS[req.assetType],
    messages: [{ role: "user", content: userMessage }],
  })

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")

  return parseAndValidate(req.assetType, text)
}

// ─── Refine ───

export interface RefineRequest {
  assetType: AssetType
  currentValues: Record<string, string | string[]>
  refinementInstruction: string
}

export async function refineAssetDraft(req: RefineRequest): Promise<Record<string, unknown>> {
  const client = getClient()

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    temperature: 0.7,
    system: `${ASSET_PROMPTS[req.assetType]}

REFINEMENT MODE: You are updating an existing draft. Only change fields that the refinement instruction affects. Preserve good values in other fields. Return the complete JSON with all fields.`,
    messages: [{
      role: "user",
      content: `Current values:\n${JSON.stringify(req.currentValues, null, 2)}\n\nRefinement request: ${req.refinementInstruction}`,
    }],
  })

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")

  return parseAndValidate(req.assetType, text)
}

// ─── Parse + Validate ───

function parseAndValidate(assetType: AssetType, rawText: string): Record<string, unknown> {
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = rawText.trim()
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) jsonStr = jsonMatch[1].trim()

  // Try to find JSON object if there's surrounding text
  const braceMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (braceMatch) jsonStr = braceMatch[0]

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    console.error("[ai-assist] Failed to parse JSON:", rawText.slice(0, 500))
    throw new Error("AI returned invalid format. Please try again.")
  }

  const schema = FIELD_SCHEMAS[assetType]
  if (!schema) throw new Error(`Unknown asset type: ${assetType}`)

  const result = schema.safeParse(parsed)
  if (result.success) return result.data as Record<string, unknown>

  // Attempt auto-repair: coerce missing fields to empty strings
  const obj = parsed as Record<string, unknown>
  for (const key of Object.keys((schema as z.ZodObject<z.ZodRawShape>).shape)) {
    if (obj[key] === undefined || obj[key] === null) {
      obj[key] = ""
    }
    if (typeof obj[key] !== "string" && !Array.isArray(obj[key])) {
      obj[key] = String(obj[key])
    }
  }

  const retry = schema.safeParse(obj)
  if (retry.success) return retry.data as Record<string, unknown>

  console.error("[ai-assist] Validation failed after repair:", result.error)
  throw new Error("AI output didn't match expected format. Please try again.")
}
