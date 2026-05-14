import { z } from "zod"

export const OutlineSectionSchema = z.object({
  title: z.string(),
  summary: z.string(),
  charactersInvolved: z.array(z.string()),
})

export const CharacterArcNoteSchema = z.object({
  characterId: z.string(),
  characterName: z.string(),
  arc: z.string(),
})

export const SupportingCharacterSchema = z.object({
  name: z.string(),
  role: z.string(),
  relationship_to_core: z.string(),
  primary_trait: z.string(),
  secondary_trait: z.string().optional(),
  emotional_function: z.string(),
  appearance: z.string(),
  voice_tone: z.string(),
  story_only: z.boolean().default(true),
})

export const StoryOutlineSchema = z.object({
  title: z.string(),
  logline: z.string(),
  sections: z.array(OutlineSectionSchema),
  characterArcs: z.array(CharacterArcNoteSchema),
  supportingCharacters: z.array(SupportingCharacterSchema).optional(),
  theme: z.string().optional(),
  moral: z.string().optional(),
  endingType: z.enum(["reassuring", "wonder", "lesson", "open"]),
})

export type StoryOutline = z.infer<typeof StoryOutlineSchema>
export type OutlineSection = z.infer<typeof OutlineSectionSchema>
