import type { StoryGenerationRequest } from "@/lib/schemas/request"

export interface StoryGenerationJobData {
  runId: string
  userId: string
  request: StoryGenerationRequest
}

export const STORY_GENERATION_JOB_NAME = "generate-story"
