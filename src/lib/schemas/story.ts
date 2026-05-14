import { z } from "zod"

export const StoryPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string().min(1),
  sceneHint: z.string().optional(),
})

export const StoryContentSchema = z.array(StoryPageSchema)

export type StoryPage = z.infer<typeof StoryPageSchema>
export type StoryContent = z.infer<typeof StoryContentSchema>
