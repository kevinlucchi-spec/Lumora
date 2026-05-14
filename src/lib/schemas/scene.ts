// @ts-nocheck
import { z } from "zod"

export const SceneSpecSchema = z.object({
  order: z.number().int().nonnegative(),
  description: z.string(),
  characters: z.array(z.string()),
  setting: z.string(),
  mood: z.string(),
  lighting: z.string().optional(),
  imagePrompt: z.string().optional(),
  warrantsIllustration: z.boolean().default(true),
})

export const SceneSpecArraySchema = z.array(SceneSpecSchema)

export type SceneSpec = z.infer<typeof SceneSpecSchema>
