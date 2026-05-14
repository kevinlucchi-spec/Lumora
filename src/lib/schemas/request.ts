import { z } from "zod"

/**
 * Unified input mode for Story Idea, World, and Art Style.
 * - "auto": AI infers based on context
 * - "library": User picks from saved assets
 * - "custom": User writes their own
 */
const InputModeSchema = z.enum(["auto", "library", "custom"])

export const StoryGenerationRequestSchema = z.object({
  seriesId: z.string().cuid(),
  branchId: z.string().cuid(),
  volumeId: z.string().cuid(),
  storyTitle: z.string().max(200).optional(),

  // Story type: new standalone story vs continuation of a previous one
  storyType: z.enum(["new", "continuation"]).default("new"),
  parentStoryId: z.string().cuid().optional(), // required when storyType=continuation

  mode: z.enum([
    "CALM_BEDTIME", "COZY_ADVENTURE", "MORAL_LESSON", "DREAMLIKE",
    "SIBLING_FAMILY", "WHAT_IF_BRANCH", "CUSTOM",
  ]),
  ageBand: z.enum(["TODDLER", "EARLY", "MIDDLE", "TWEEN", "PRETEEN"]),

  // Characters
  characterIds: z.array(z.string().cuid()).min(0).max(10),

  // Supporting characters
  supportingCharacterMode: z.enum(["none", "auto", "add_one"]).default("auto"),
  supportingCharacterDescription: z.string().max(300).optional(),

  // Story idea — unified input
  storyIdeaMode: InputModeSchema.default("auto"),
  prompt: z.string().max(2000).optional(),
  promptSeedId: z.string().cuid().optional(),

  // World — unified input
  worldMode: InputModeSchema.default("auto"),
  worldId: z.string().cuid().optional(),
  customWorld: z.string().max(500).optional(),

  // Art style — unified input
  artStyleMode: InputModeSchema.default("auto"),
  artStylePresetId: z.string().cuid().optional(),
  customArtStyle: z.string().max(500).optional(),

  length: z.enum(["quick", "short", "medium", "long"]).default("quick"),
  customToneOverride: z.string().max(500).optional(),
  generateImages: z.boolean().default(false),
})

export type StoryGenerationRequest = z.infer<typeof StoryGenerationRequestSchema>
