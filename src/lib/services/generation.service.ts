import { prisma } from "@/lib/prisma"
import { getStoryGenerationQueue } from "@/lib/queue/queues"
import { STORY_GENERATION_JOB_NAME } from "@/lib/queue/jobs/story-generation.job"
import type { StoryGenerationRequest } from "@/lib/schemas/request"

export async function enqueueStoryGeneration(userId: string, request: StoryGenerationRequest) {
  const run = await prisma.generationRun.create({
    data: {
      userId,
      status: "PENDING",
      requestPayload: request,
    },
  })

  const queue = getStoryGenerationQueue()
  await queue.add(STORY_GENERATION_JOB_NAME, {
    runId: run.id,
    userId,
    request,
  })

  return run
}

export async function getGenerationRun(runId: string, userId: string) {
  return prisma.generationRun.findFirst({
    where: { id: runId, userId },
  })
}
